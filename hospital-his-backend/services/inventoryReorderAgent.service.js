/**
 * Inventory Reorder Agent Service
 * LLM-based agentic workflow for low-stock reorder in general stores
 * 
 * All math is deterministic - LLM only orchestrates tool calls.
 */

const mongoose = require('mongoose');
const InventoryItem = require('../models/InventoryItem');
const InventoryStock = require('../models/InventoryStock');
const DraftPurchaseRequest = require('../models/DraftPurchaseRequest');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════
// GLOBAL CONSTANTS (Hardcoded as per spec)
// ═══════════════════════════════════════════════════════════════════
const MAX_LEAD_TIME_DAYS = 14;
const REORDER_BUDGET_CAP = 100000; // INR (1 lakh) - All approvals go to inventory_manager

// Approval tier thresholds (INR) - Not used, all go to inventory_manager
const APPROVAL_TIERS = {
    INVENTORY_MANAGER: 100000,    // All approvals go to inventory_manager
};


// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (Deterministic)
// ═══════════════════════════════════════════════════════════════════

/**
 * Safe stock getter - aggregates available stock across all batches/locations
 * Priority order: availableQuantity > quantity > 0
 * @param {ObjectId} itemId - The inventory item ID
 * @returns {Promise<number>} - Total available stock
 */
const getAvailableStock = async (itemId) => {
    try {
        const stockRecords = await InventoryStock.find({
            item: itemId,
            isBlocked: { $ne: true },
        });

        if (!stockRecords || stockRecords.length === 0) {
            return 0;
        }

        let totalAvailable = 0;
        for (const record of stockRecords) {
            // Priority: availableQuantity > quantity > 0
            const qty = record.availableQuantity ?? record.quantity ?? 0;
            totalAvailable += Math.max(0, qty);
        }

        return totalAvailable;
    } catch (error) {
        logger.error(`[ReorderAgent] Error getting stock for ${itemId}: ${error.message}`);
        return 0;
    }
};

/**
 * Clamp a value between min and max
 */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Calculate urgency score using the exact formula from spec
 * urgency_score = 100 * (0.55*deficit_ratio + 0.25*priority_norm + 0.15*lead_norm + 0.05*stockout)
 */
const calculateUrgencyScore = (available, minLevel, priority, leadDays) => {
    // deficit = max(0, minLevel - available)
    const deficit = Math.max(0, minLevel - available);

    // deficit_ratio = min(1, deficit / max(1, minLevel))
    const deficitRatio = Math.min(1, deficit / Math.max(1, minLevel));

    // priority_norm = (priority - 1) / 4
    const priorityNorm = (priority - 1) / 4;

    // lead_norm = min(1, leadDays / MAX_LEAD_TIME_DAYS)
    const leadNorm = Math.min(1, leadDays / MAX_LEAD_TIME_DAYS);

    // stockout = (available == 0 ? 1 : 0)
    const stockout = available === 0 ? 1 : 0;

    // urgency_score = 100 * (0.55*deficit_ratio + 0.25*priority_norm + 0.15*lead_norm + 0.05*stockout)
    const urgencyScore = 100 * (
        0.55 * deficitRatio +
        0.25 * priorityNorm +
        0.15 * leadNorm +
        0.05 * stockout
    );

    return Math.round(urgencyScore * 100) / 100; // Round to 2 decimal places
};

/**
 * Calculate recommended order quantity
 * recommended_order_qty = clamp(target - available, 0, maxOrderQty)
 */
const calculateRecommendedQty = (available, targetLevel, maxOrderQty) => {
    return clamp(targetLevel - available, 0, maxOrderQty);
};

/**
 * Determine approval tier based on total cost
 * NOTE: All approvals go to inventory_manager since we don't have finance_head/supervisor
 */
const determineApproverRole = (totalCost) => {
    // All approvals routed to inventory_manager
    return 'inventory_manager';
};

/**
 * Generate flags for an item
 */
const generateFlags = (available, minLevel, priority, leadDays) => {
    const flags = [];

    if (available === 0) {
        flags.push('STOCKOUT');
    }

    if (available <= minLevel) {
        flags.push('BELOW_MIN');
    }

    if (priority >= 4) {
        flags.push('HIGH_PRIORITY');
    }

    if (leadDays >= 10) {
        flags.push('LONG_LEAD_TIME');
    }

    return flags;
};

// ═══════════════════════════════════════════════════════════════════
// TOOL FUNCTIONS (For LLM to call)
// ═══════════════════════════════════════════════════════════════════

/**
 * Tool A: Get low stock items from general_stores
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} - List of low stock items
 */
const getLowStockItems = async (filters = {}) => {
    try {
        logger.info('[ReorderAgent] Tool A: Getting low stock items...');

        // Query items with policy category = general_stores and minLevel > 0
        const items = await InventoryItem.find({
            policyCategory: 'general_stores',
            isActive: true,
            'policy.minLevel': { $gt: 0 },
        }).lean();

        const lowStockItems = [];

        for (const item of items) {
            const availableStock = await getAvailableStock(item._id);
            const minLevel = item.policy?.minLevel || 0;

            // Filter: available_stock <= policy.minLevel
            if (availableStock <= minLevel) {
                lowStockItems.push({
                    itemId: item._id.toString(),
                    itemCode: item.itemCode,
                    itemName: item.itemName,
                    uom: item.uom,
                    availableStock,
                    minLevel: item.policy.minLevel,
                    targetLevel: item.policy.targetLevel,
                    priority: item.policy.priority,
                    leadTimeDays: item.policy.leadTimeDays,
                    unitCost: item.policy.unitCost,
                    maxOrderQty: item.policy.maxOrderQty,
                });
            }
        }

        logger.info(`[ReorderAgent] Found ${lowStockItems.length} low stock items`);
        return lowStockItems;
    } catch (error) {
        logger.error(`[ReorderAgent] Tool A error: ${error.message}`);
        throw error;
    }
};

/**
 * Tool B: Compute reorder plan with budget-based prioritization
 * @param {Array} items - Low stock items from Tool A
 * @param {number} budgetCap - Budget cap (default: REORDER_BUDGET_CAP)
 * @returns {Object} - Reorder plan with included and deferred items
 */
const computeReorderPlan = (items, budgetCap = REORDER_BUDGET_CAP) => {
    logger.info(`[ReorderAgent] Tool B: Computing reorder plan (budget cap: ₹${budgetCap})...`);

    // Compute metrics for each item
    const itemsWithMetrics = items.map(item => {
        const urgencyScore = calculateUrgencyScore(
            item.availableStock,
            item.minLevel,
            item.priority,
            item.leadTimeDays
        );

        const recommendedOrderQty = calculateRecommendedQty(
            item.availableStock,
            item.targetLevel,
            item.maxOrderQty
        );

        const estimatedCost = recommendedOrderQty * item.unitCost;

        const flags = generateFlags(
            item.availableStock,
            item.minLevel,
            item.priority,
            item.leadTimeDays
        );

        return {
            ...item,
            urgencyScore,
            recommendedOrderQty,
            estimatedCost,
            flags,
        };
    });

    // Sort by urgency score descending
    itemsWithMetrics.sort((a, b) => b.urgencyScore - a.urgencyScore);

    // Split based on budget cap
    const withinBudgetItems = [];
    const deferredItems = [];
    let cumulativeCost = 0;

    for (const item of itemsWithMetrics) {
        if (cumulativeCost + item.estimatedCost <= budgetCap) {
            withinBudgetItems.push(item);
            cumulativeCost += item.estimatedCost;
        } else {
            deferredItems.push(item);
        }
    }

    // Calculate totals
    const totalCostAll = itemsWithMetrics.reduce((sum, item) => sum + item.estimatedCost, 0);
    const totalCostIncluded = withinBudgetItems.reduce((sum, item) => sum + item.estimatedCost, 0);

    const plan = {
        totals: {
            totalCostAll: Math.round(totalCostAll * 100) / 100,
            totalCostIncluded: Math.round(totalCostIncluded * 100) / 100,
            itemsEvaluated: items.length,
            itemsIncluded: withinBudgetItems.length,
            itemsDeferred: deferredItems.length,
        },
        withinBudgetItems,
        deferredItems,
    };

    logger.info(`[ReorderAgent] Plan computed: ${plan.totals.itemsIncluded} items included (₹${plan.totals.totalCostIncluded}), ${plan.totals.itemsDeferred} deferred`);
    return plan;
};

/**
 * Tool C: Create draft purchase request in DB
 * @param {Object} payload - Draft data including plan and explanation
 * @returns {Promise<Object>} - Created draft info
 */
const createDraftPurchaseRequest = async (payload) => {
    try {
        logger.info('[ReorderAgent] Tool C: Creating draft purchase request...');

        const { plan, createdBy, budgetCap, explanationText, policyCategory = 'general_stores' } = payload;

        // Map items to schema format (remove itemId which is internal)
        const mapItem = (item) => ({
            itemCode: item.itemCode,
            itemName: item.itemName,
            uom: item.uom,
            availableStock: item.availableStock,
            minLevel: item.minLevel,
            targetLevel: item.targetLevel,
            recommendedOrderQty: item.recommendedOrderQty,
            unitCost: item.unitCost,
            estimatedCost: item.estimatedCost,
            urgencyScore: item.urgencyScore,
            priority: item.priority,
            leadTimeDays: item.leadTimeDays,
            flags: item.flags,
        });

        const draft = new DraftPurchaseRequest({
            status: 'pending_approval',
            policyCategory,
            createdBy,
            budgetCap,
            totals: plan.totals,
            withinBudgetItems: plan.withinBudgetItems.map(mapItem),
            deferredItems: plan.deferredItems.map(mapItem),
            explanationText,
        });

        await draft.save();

        logger.info(`[ReorderAgent] Draft created: ${draft.draftNumber}`);
        return {
            draftId: draft._id.toString(),
            draftNumber: draft.draftNumber,
        };
    } catch (error) {
        logger.error(`[ReorderAgent] Tool C error: ${error.message}`);
        throw error;
    }
};

/**
 * Tool D: Route draft for approval based on cost tiers
 * @param {string} draftId - Draft ID
 * @param {number} totalCostAll - Total cost of all items
 * @returns {Promise<Object>} - Routing info
 */
const routeForApproval = async (draftId, totalCostAll) => {
    try {
        logger.info(`[ReorderAgent] Tool D: Routing draft ${draftId} for approval...`);

        const requiredApproverRole = determineApproverRole(totalCostAll);

        await DraftPurchaseRequest.findByIdAndUpdate(draftId, {
            requiredApproverRole,
        });

        logger.info(`[ReorderAgent] Draft routed to: ${requiredApproverRole}`);
        return { requiredApproverRole };
    } catch (error) {
        logger.error(`[ReorderAgent] Tool D error: ${error.message}`);
        throw error;
    }
};

/**
 * Tool E: Notify approvers via in-app notifications
 * @param {string} requiredApproverRole - Role to notify
 * @param {string} message - Notification message
 * @param {string} draftId - Draft ID for reference
 * @returns {Promise<Object>} - Notification result
 */
const notifyApprover = async (requiredApproverRole, message, draftId) => {
    try {
        // Always notify inventory_manager (finance_head/supervisor don't exist)
        const targetRole = 'inventory_manager';
        logger.info(`[ReorderAgent] Tool E: Notifying ${targetRole}...`);

        // Find users with inventory_manager role
        const approvers = await User.find({
            role: targetRole,
            isActive: true,
        }).select('_id');

        const notifications = [];
        for (const approver of approvers) {
            const notification = await Notification.create({
                recipient: approver._id,
                type: 'warning', // Using warning type for approval requests
                title: '🔔 Inventory Reorder Draft Pending Approval',
                message,
                relatedEntity: {
                    type: 'DraftPurchaseRequest',
                    id: draftId,
                },
                actionUrl: `/inventory-manager/draft-purchase-requests/${draftId}`,
                priority: 2,
            });
            notifications.push(notification._id);
        }

        logger.info(`[ReorderAgent] Notified ${notifications.length} approvers`);
        return {
            notifiedCount: notifications.length,
            approverRole: requiredApproverRole,
        };
    } catch (error) {
        logger.error(`[ReorderAgent] Tool E error: ${error.message}`);
        throw error;
    }
};

/**
 * Tool F: Write audit log for the agent run
 * @param {Object} event - Audit event data
 * @returns {Promise<Object>} - Audit log result
 */
const writeAuditLog = async (event) => {
    try {
        logger.info('[ReorderAgent] Tool F: Writing audit log...');

        const {
            userId,
            draftId,
            itemCodesAccessed,
            itemsEvaluated,
            itemsIncluded,
            itemsDeferred,
            totalCostAll,
            totalCostIncluded,
            requiredApproverRole,
        } = event;

        const auditLog = await AuditLog.create({
            user: userId,
            action: 'inventory_reorder_agent_run',
            entity: 'DraftPurchaseRequest',
            entityId: draftId,
            description: `AI agent generated reorder draft with ${itemsIncluded} items (₹${totalCostIncluded})`,
            metadata: {
                itemCodesAccessed,
                itemsEvaluated,
                itemsIncluded,
                itemsDeferred,
                totalCostAll,
                totalCostIncluded,
                requiredApproverRole,
                agentType: 'inventory_reorder',
                timestamp: new Date().toISOString(),
            },
        });

        logger.info(`[ReorderAgent] Audit log created: ${auditLog._id}`);
        return {
            auditLogId: auditLog._id.toString(),
        };
    } catch (error) {
        logger.error(`[ReorderAgent] Tool F error: ${error.message}`);
        throw error;
    }
};

// ═══════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS (For LLM function calling)
// ═══════════════════════════════════════════════════════════════════

const TOOL_DEFINITIONS = [
    {
        type: 'function',
        function: {
            name: 'getLowStockItems',
            description: 'Fetches low-stock items from general_stores inventory where available stock <= min level. Returns array with item details and policy values.',
            parameters: {
                type: 'object',
                properties: {
                    filters: {
                        type: 'object',
                        description: 'Optional filters (currently unused)',
                    },
                },
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'computeReorderPlan',
            description: 'Computes a deterministic reorder plan with urgency scores, recommended quantities, and budget prioritization. Splits items into within_budget and deferred based on budget cap.',
            parameters: {
                type: 'object',
                properties: {
                    items: {
                        type: 'array',
                        description: 'Array of low stock items from getLowStockItems',
                    },
                    budgetCap: {
                        type: 'number',
                        description: 'Budget cap in INR (default: 25000)',
                    },
                },
                required: ['items'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'createDraftPurchaseRequest',
            description: 'Creates a draft purchase request in the database with status pending_approval. Stores all computed values.',
            parameters: {
                type: 'object',
                properties: {
                    plan: {
                        type: 'object',
                        description: 'The reorder plan from computeReorderPlan',
                    },
                    explanationText: {
                        type: 'string',
                        description: 'Human-readable explanation of the reorder plan (should reference actual numbers from the plan)',
                    },
                },
                required: ['plan', 'explanationText'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'routeForApproval',
            description: 'Routes the draft to the appropriate approver based on cost tiers. Updates the draft with requiredApproverRole.',
            parameters: {
                type: 'object',
                properties: {
                    draftId: {
                        type: 'string',
                        description: 'The draft purchase request ID',
                    },
                    totalCostAll: {
                        type: 'number',
                        description: 'Total cost of all items in the plan',
                    },
                },
                required: ['draftId', 'totalCostAll'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'notifyApprover',
            description: 'Creates in-app notifications for users with the required approver role.',
            parameters: {
                type: 'object',
                properties: {
                    requiredApproverRole: {
                        type: 'string',
                        description: 'The role that needs to approve (inventory_manager, supervisor, or finance_head)',
                    },
                    message: {
                        type: 'string',
                        description: 'Notification message describing the pending approval',
                    },
                    draftId: {
                        type: 'string',
                        description: 'The draft purchase request ID for reference',
                    },
                },
                required: ['requiredApproverRole', 'message', 'draftId'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'writeAuditLog',
            description: 'Writes an audit log entry for the agent run with all relevant metadata.',
            parameters: {
                type: 'object',
                properties: {
                    itemCodesAccessed: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of item codes that were evaluated',
                    },
                    itemsEvaluated: {
                        type: 'number',
                        description: 'Number of items evaluated',
                    },
                    itemsIncluded: {
                        type: 'number',
                        description: 'Number of items included in budget',
                    },
                    itemsDeferred: {
                        type: 'number',
                        description: 'Number of deferred items',
                    },
                    totalCostAll: {
                        type: 'number',
                        description: 'Total cost of all items',
                    },
                    totalCostIncluded: {
                        type: 'number',
                        description: 'Total cost of included items',
                    },
                    requiredApproverRole: {
                        type: 'string',
                        description: 'The approver role assigned',
                    },
                    draftId: {
                        type: 'string',
                        description: 'The created draft ID',
                    },
                },
                required: ['itemCodesAccessed', 'itemsEvaluated', 'draftId'],
            },
        },
    },
];

// ═══════════════════════════════════════════════════════════════════
// TOOL EXECUTOR
// ═══════════════════════════════════════════════════════════════════

/**
 * Execute a tool call from the LLM
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} args - Arguments for the tool
 * @param {Object} context - Execution context (userId, etc.)
 * @returns {Promise<Object>} - Tool result
 */
const executeTool = async (toolName, args, context) => {
    logger.info(`[ReorderAgent] Executing tool: ${toolName}`);

    switch (toolName) {
        case 'getLowStockItems':
            return await getLowStockItems(args.filters);

        case 'computeReorderPlan':
            return computeReorderPlan(args.items, args.budgetCap || REORDER_BUDGET_CAP);

        case 'createDraftPurchaseRequest':
            return await createDraftPurchaseRequest({
                plan: args.plan,
                explanationText: args.explanationText,
                createdBy: context.userId,
                budgetCap: context.budgetCap || REORDER_BUDGET_CAP,
            });

        case 'routeForApproval':
            return await routeForApproval(args.draftId, args.totalCostAll);

        case 'notifyApprover':
            return await notifyApprover(args.requiredApproverRole, args.message, args.draftId);

        case 'writeAuditLog':
            return await writeAuditLog({
                userId: context.userId,
                draftId: args.draftId,
                itemCodesAccessed: args.itemCodesAccessed,
                itemsEvaluated: args.itemsEvaluated,
                itemsIncluded: args.itemsIncluded,
                itemsDeferred: args.itemsDeferred,
                totalCostAll: args.totalCostAll,
                totalCostIncluded: args.totalCostIncluded,
                requiredApproverRole: args.requiredApproverRole,
            });

        default:
            throw new Error(`Unknown tool: ${toolName}`);
    }
};

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    // Constants
    MAX_LEAD_TIME_DAYS,
    REORDER_BUDGET_CAP,
    APPROVAL_TIERS,

    // Helper functions
    getAvailableStock,
    calculateUrgencyScore,
    calculateRecommendedQty,
    determineApproverRole,
    generateFlags,

    // Tool functions
    getLowStockItems,
    computeReorderPlan,
    createDraftPurchaseRequest,
    routeForApproval,
    notifyApprover,
    writeAuditLog,

    // LLM integration
    TOOL_DEFINITIONS,
    executeTool,
};
