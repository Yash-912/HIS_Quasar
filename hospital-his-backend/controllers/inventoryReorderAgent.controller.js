/**
 * Inventory Reorder Agent Controller
 * Handles API endpoints for the agentic reorder workflow
 */

const DraftPurchaseRequest = require('../models/DraftPurchaseRequest');
const PurchaseRequisition = require('../models/PurchaseRequisition');
const { runReorderAgent, runReorderAgentDirect } = require('../services/inventoryAgentLLM.service');
const { REORDER_BUDGET_CAP } = require('../services/inventoryReorderAgent.service');
const logger = require('../utils/logger');

/**
 * POST /inventory-manager/reorder/agent/draft
 * Trigger the reorder agent to generate a draft purchase request
 */
const generateReorderDraft = async (req, res) => {
    try {
        const userId = req.user._id;
        const { budgetCap, useDirect } = req.body;

        logger.info(`[ReorderController] Agent triggered by user ${userId}`);

        // Use direct execution if specified or if LLM API key is missing
        const useDirectMode = useDirect || !process.env.OPENROUTER_AGENTIC_INVENTORY_API_KEY;

        let result;
        if (useDirectMode) {
            logger.info('[ReorderController] Using direct execution mode');
            result = await runReorderAgentDirect(userId, budgetCap || REORDER_BUDGET_CAP);
        } else {
            logger.info('[ReorderController] Using LLM-orchestrated mode');
            result = await runReorderAgent(userId, budgetCap || REORDER_BUDGET_CAP);
        }

        res.status(201).json({
            success: true,
            message: result.message,
            data: {
                draftId: result.draftId,
                draftNumber: result.draftNumber,
                summary: result.summary,
                agentMetadata: result.agentMetadata,
            },
        });
    } catch (error) {
        logger.error(`[ReorderController] generateReorderDraft error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * GET /inventory-manager/draft-purchase-requests
 * List all draft purchase requests
 */
const getDraftPurchaseRequests = async (req, res) => {
    try {
        const { status, policyCategory, page = 1, limit = 20 } = req.query;

        const query = {};
        if (status) query.status = status;
        if (policyCategory) query.policyCategory = policyCategory;

        const skip = (page - 1) * limit;

        const [drafts, total] = await Promise.all([
            DraftPurchaseRequest.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('createdBy', 'email profile.firstName profile.lastName')
                .populate('approvedBy', 'email profile.firstName profile.lastName')
                .populate('rejectedBy', 'email profile.firstName profile.lastName')
                .lean(),
            DraftPurchaseRequest.countDocuments(query),
        ]);

        res.json({
            success: true,
            data: drafts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        logger.error(`[ReorderController] getDraftPurchaseRequests error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * GET /inventory-manager/draft-purchase-requests/:id
 * Get a single draft purchase request
 */
const getDraftPurchaseRequest = async (req, res) => {
    try {
        const { id } = req.params;

        const draft = await DraftPurchaseRequest.findById(id)
            .populate('createdBy', 'email profile.firstName profile.lastName')
            .populate('approvedBy', 'email profile.firstName profile.lastName')
            .populate('rejectedBy', 'email profile.firstName profile.lastName')
            .populate('convertedToPR', 'prNumber status')
            .lean();

        if (!draft) {
            return res.status(404).json({
                success: false,
                error: 'Draft purchase request not found',
            });
        }

        res.json({
            success: true,
            data: draft,
        });
    } catch (error) {
        logger.error(`[ReorderController] getDraftPurchaseRequest error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * PUT /inventory-manager/draft-purchase-requests/:id/approve
 * Approve a draft purchase request
 */
const approveDraftPurchaseRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const userRole = req.user.role;

        const draft = await DraftPurchaseRequest.findById(id);

        if (!draft) {
            return res.status(404).json({
                success: false,
                error: 'Draft purchase request not found',
            });
        }

        if (draft.status !== 'pending_approval') {
            return res.status(400).json({
                success: false,
                error: `Cannot approve draft with status: ${draft.status}`,
            });
        }

        // Check if user has the required role to approve
        const requiredRole = draft.requiredApproverRole;
        const allowedRoles = ['admin', 'finance_head', 'supervisor', 'inventory_manager'];

        // Role hierarchy check
        const roleHierarchy = {
            'admin': 4,
            'finance_head': 3,
            'supervisor': 2,
            'inventory_manager': 1,
        };

        const userRoleLevel = roleHierarchy[userRole] || 0;
        const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

        if (userRoleLevel < requiredRoleLevel && userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                error: `Insufficient permissions. Requires ${requiredRole} or higher.`,
            });
        }

        // Update draft status
        draft.status = 'approved';
        draft.approvedBy = userId;
        draft.approvedAt = new Date();
        await draft.save();

        logger.info(`[ReorderController] Draft ${draft.draftNumber} approved by ${userId}`);

        res.json({
            success: true,
            message: `Draft ${draft.draftNumber} approved successfully`,
            data: {
                draftId: draft._id,
                draftNumber: draft.draftNumber,
                status: draft.status,
                approvedAt: draft.approvedAt,
            },
        });
    } catch (error) {
        logger.error(`[ReorderController] approveDraftPurchaseRequest error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * PUT /inventory-manager/draft-purchase-requests/:id/reject
 * Reject a draft purchase request
 */
const rejectDraftPurchaseRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user._id;

        if (!reason) {
            return res.status(400).json({
                success: false,
                error: 'Rejection reason is required',
            });
        }

        const draft = await DraftPurchaseRequest.findById(id);

        if (!draft) {
            return res.status(404).json({
                success: false,
                error: 'Draft purchase request not found',
            });
        }

        if (draft.status !== 'pending_approval') {
            return res.status(400).json({
                success: false,
                error: `Cannot reject draft with status: ${draft.status}`,
            });
        }

        // Update draft status
        draft.status = 'rejected';
        draft.rejectedBy = userId;
        draft.rejectedAt = new Date();
        draft.rejectionReason = reason;
        await draft.save();

        logger.info(`[ReorderController] Draft ${draft.draftNumber} rejected by ${userId}`);

        res.json({
            success: true,
            message: `Draft ${draft.draftNumber} rejected`,
            data: {
                draftId: draft._id,
                draftNumber: draft.draftNumber,
                status: draft.status,
                rejectionReason: draft.rejectionReason,
            },
        });
    } catch (error) {
        logger.error(`[ReorderController] rejectDraftPurchaseRequest error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * POST /inventory-manager/draft-purchase-requests/:id/convert
 * Convert an approved draft to a Purchase Requisition
 */
const convertToPurchaseRequisition = async (req, res) => {
    try {
        const { id } = req.params;
        const { departmentId } = req.body;
        const userId = req.user._id;

        const draft = await DraftPurchaseRequest.findById(id);

        if (!draft) {
            return res.status(404).json({
                success: false,
                error: 'Draft purchase request not found',
            });
        }

        if (draft.status !== 'approved') {
            return res.status(400).json({
                success: false,
                error: `Can only convert approved drafts. Current status: ${draft.status}`,
            });
        }

        // Create Purchase Requisition from the draft
        const InventoryItem = require('../models/InventoryItem');

        // Map items to PR items format
        const prItems = [];
        for (const item of draft.withinBudgetItems) {
            const inventoryItem = await InventoryItem.findOne({ itemCode: item.itemCode });
            if (inventoryItem) {
                prItems.push({
                    item: inventoryItem._id,
                    quantity: item.recommendedOrderQty,
                    estimatedRate: item.unitCost,
                    estimatedAmount: item.estimatedCost,
                    remarks: `Auto-generated from draft ${draft.draftNumber}. Urgency: ${item.urgencyScore}`,
                });
            }
        }

        // Create the PR
        const pr = new PurchaseRequisition({
            requestingDepartment: departmentId,
            priority: 'high',
            items: prItems,
            totalEstimatedAmount: draft.totals.totalCostIncluded,
            justification: `Converted from AI-generated reorder draft ${draft.draftNumber}. ${draft.explanationText}`,
            status: 'submitted',
            submittedAt: new Date(),
            createdBy: userId,
        });

        await pr.save();

        // Update draft status
        draft.status = 'converted';
        draft.convertedToPR = pr._id;
        await draft.save();

        logger.info(`[ReorderController] Draft ${draft.draftNumber} converted to PR ${pr.prNumber}`);

        res.json({
            success: true,
            message: `Draft converted to Purchase Requisition ${pr.prNumber}`,
            data: {
                draftId: draft._id,
                draftNumber: draft.draftNumber,
                purchaseRequisitionId: pr._id,
                prNumber: pr.prNumber,
            },
        });
    } catch (error) {
        logger.error(`[ReorderController] convertToPurchaseRequisition error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * POST /inventory-manager/draft-purchase-requests/:id/fulfill
 * Fulfill an approved draft - directly update inventory (simulates supplier delivery)
 * This is a simplified flow since we don't have a real supplier
 */
const fulfillDraftPurchaseRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const draft = await DraftPurchaseRequest.findById(id);

        if (!draft) {
            return res.status(404).json({
                success: false,
                error: 'Draft purchase request not found',
            });
        }

        // Allow fulfilling pending_approval or approved drafts
        if (draft.status !== 'pending_approval' && draft.status !== 'approved') {
            return res.status(400).json({
                success: false,
                error: `Cannot fulfill draft with status: ${draft.status}`,
            });
        }

        const InventoryItem = require('../models/InventoryItem');
        const InventoryStock = require('../models/InventoryStock');
        const Location = require('../models/Location');

        // Get default location
        let defaultLocation = await Location.findOne({ isDefault: true });
        if (!defaultLocation) {
            defaultLocation = await Location.findOne();
        }

        const updatedItems = [];

        // Update stock for each item in the draft
        for (const item of draft.withinBudgetItems) {
            const inventoryItem = await InventoryItem.findOne({ itemCode: item.itemCode });

            if (inventoryItem) {
                // Find existing stock record or create new one
                let stockRecord = await InventoryStock.findOne({
                    item: inventoryItem._id,
                    location: defaultLocation?._id,
                });

                if (stockRecord) {
                    // Update existing stock
                    stockRecord.quantity += item.recommendedOrderQty;
                    stockRecord.availableQuantity += item.recommendedOrderQty;
                    stockRecord.lastUpdated = new Date();
                    await stockRecord.save();
                } else {
                    // Create new stock record
                    stockRecord = await InventoryStock.create({
                        item: inventoryItem._id,
                        location: defaultLocation?._id,
                        quantity: item.recommendedOrderQty,
                        availableQuantity: item.recommendedOrderQty,
                        reservedQuantity: 0,
                        batchNumber: `REORDER-${draft.draftNumber}`,
                        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
                        createdBy: userId,
                    });
                }

                // Update item's total quantity
                inventoryItem.totalQuantity = (inventoryItem.totalQuantity || 0) + item.recommendedOrderQty;
                inventoryItem.lastUpdated = new Date();
                await inventoryItem.save();

                updatedItems.push({
                    itemCode: item.itemCode,
                    itemName: item.itemName,
                    quantityAdded: item.recommendedOrderQty,
                    newTotal: inventoryItem.totalQuantity,
                });
            }
        }

        // Update draft status
        draft.status = 'converted'; // Reusing converted status for fulfilled
        draft.approvedBy = userId;
        draft.approvedAt = new Date();
        await draft.save();

        logger.info(`[ReorderController] Draft ${draft.draftNumber} fulfilled, ${updatedItems.length} items updated`);

        res.json({
            success: true,
            message: `Draft ${draft.draftNumber} fulfilled. ${updatedItems.length} items restocked.`,
            data: {
                draftId: draft._id,
                draftNumber: draft.draftNumber,
                status: 'fulfilled',
                updatedItems,
                totalItemsUpdated: updatedItems.length,
            },
        });
    } catch (error) {
        logger.error(`[ReorderController] fulfillDraftPurchaseRequest error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

module.exports = {
    generateReorderDraft,
    getDraftPurchaseRequests,
    getDraftPurchaseRequest,
    approveDraftPurchaseRequest,
    rejectDraftPurchaseRequest,
    convertToPurchaseRequisition,
    fulfillDraftPurchaseRequest,
};
