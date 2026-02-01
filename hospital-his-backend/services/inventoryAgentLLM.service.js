/**
 * Inventory Agent LLM Service
 * Handles LLM orchestration for the agentic reorder workflow
 * 
 * Uses OpenRouter API with function calling to orchestrate tool execution.
 * The LLM decides which tools to call and in what order, but all math
 * is computed deterministically by the tool functions.
 */

const axios = require('axios');
const logger = require('../utils/logger');
const {
    TOOL_DEFINITIONS,
    executeTool,
    REORDER_BUDGET_CAP,
} = require('./inventoryReorderAgent.service');

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const OPENROUTER_API_KEY = process.env.OPENROUTER_AGENTIC_INVENTORY_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_AGENTIC_INVENTORY_MODEL || 'nvidia/nemotron-3-nano-30b-a3b:free';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Maximum number of tool call rounds to prevent infinite loops
const MAX_TOOL_ROUNDS = 10;

// ═══════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are an Inventory Reorder Agent for a hospital's general stores department.
Your job is to identify low-stock items and create a draft purchase request for approval.

IMPORTANT RULES:
1. You must call tools in the correct sequence - do not skip steps
2. All numerical values (urgency scores, quantities, costs) come from tool outputs - never invent numbers
3. When writing explanationText, use the EXACT numbers from the computeReorderPlan output
4. You can only create drafts, not approve orders
5. Always complete all 6 steps before finishing

REQUIRED SEQUENCE:
1. Call getLowStockItems() to fetch items needing reorder
2. Call computeReorderPlan() with the items and budget cap to get the prioritized plan
3. Call createDraftPurchaseRequest() with the plan and a clear explanation
4. Call routeForApproval() with the draft ID and total cost
5. Call notifyApprover() to alert the appropriate approver
6. Call writeAuditLog() to record this agent run

After completing all steps, provide a brief summary confirming the draft was created.

BUDGET CAP: ₹25,000 (INR)

APPROVAL TIERS:
- ≤ ₹5,000: inventory_manager
- ₹5,001 to ₹25,000: supervisor  
- > ₹25,000: finance_head`;

// ═══════════════════════════════════════════════════════════════════
// LLM CLIENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Call the OpenRouter API
 * @param {Array} messages - Chat messages
 * @param {Array} tools - Tool definitions
 * @returns {Promise<Object>} - API response
 */
const callOpenRouter = async (messages, tools = null) => {
    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_AGENTIC_INVENTORY_API_KEY not configured');
    }

    const requestBody = {
        model: OPENROUTER_MODEL,
        messages,
        temperature: 0.1, // Low temperature for consistent behavior
        max_tokens: 4000,
    };

    if (tools && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = 'auto';
    }

    try {
        const response = await axios.post(OPENROUTER_BASE_URL, requestBody, {
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:5001',
                'X-Title': 'Hospital HIS Inventory Reorder Agent',
            },
            timeout: 60000, // 60 second timeout
        });

        return response.data;
    } catch (error) {
        logger.error(`[AgentLLM] OpenRouter API error: ${error.response?.data || error.message}`);
        throw new Error(`LLM API failed: ${error.response?.data?.error?.message || error.message}`);
    }
};

/**
 * Process tool calls from the LLM response
 * @param {Array} toolCalls - Tool calls from LLM
 * @param {Object} context - Execution context
 * @returns {Promise<Array>} - Tool results as messages
 */
const processToolCalls = async (toolCalls, context) => {
    const toolMessages = [];

    for (const toolCall of toolCalls) {
        const { id, function: func } = toolCall;
        const toolName = func.name;

        let args = {};
        try {
            args = JSON.parse(func.arguments || '{}');
        } catch (e) {
            logger.warn(`[AgentLLM] Failed to parse tool arguments: ${func.arguments}`);
        }

        try {
            const result = await executeTool(toolName, args, context);

            // Store important results in context for later use
            if (toolName === 'getLowStockItems') {
                context.lowStockItems = result;
            } else if (toolName === 'computeReorderPlan') {
                context.reorderPlan = result;
            } else if (toolName === 'createDraftPurchaseRequest') {
                context.draftResult = result;
            } else if (toolName === 'routeForApproval') {
                context.routingResult = result;
            }

            toolMessages.push({
                role: 'tool',
                tool_call_id: id,
                content: JSON.stringify(result),
            });
        } catch (error) {
            logger.error(`[AgentLLM] Tool execution error (${toolName}): ${error.message}`);
            toolMessages.push({
                role: 'tool',
                tool_call_id: id,
                content: JSON.stringify({ error: error.message }),
            });
        }
    }

    return toolMessages;
};

// ═══════════════════════════════════════════════════════════════════
// AGENT ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════

/**
 * Run the reorder agent
 * @param {string} userId - User ID triggering the agent
 * @param {number} budgetCap - Optional budget cap override
 * @returns {Promise<Object>} - Agent result
 */
const runReorderAgent = async (userId, budgetCap = REORDER_BUDGET_CAP) => {
    const startTime = Date.now();
    logger.info(`[AgentLLM] Starting reorder agent for user ${userId}...`);

    // Execution context
    const context = {
        userId,
        budgetCap,
        lowStockItems: null,
        reorderPlan: null,
        draftResult: null,
        routingResult: null,
    };

    // Initialize messages
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'user',
            content: `Please analyze the general stores inventory and create a reorder draft for low-stock items. Budget cap is ₹${budgetCap}.`,
        },
    ];

    let toolCallsCount = 0;
    let round = 0;

    // Agent loop - keep calling LLM until it stops requesting tool calls
    while (round < MAX_TOOL_ROUNDS) {
        round++;
        logger.info(`[AgentLLM] Round ${round}...`);

        const response = await callOpenRouter(messages, TOOL_DEFINITIONS);
        const choice = response.choices?.[0];

        if (!choice) {
            throw new Error('No response from LLM');
        }

        const message = choice.message;
        messages.push(message);

        // Check if LLM wants to call tools
        if (message.tool_calls && message.tool_calls.length > 0) {
            toolCallsCount += message.tool_calls.length;

            // Execute tool calls and add results to messages
            const toolMessages = await processToolCalls(message.tool_calls, context);
            messages.push(...toolMessages);
        } else {
            // LLM is done - no more tool calls
            logger.info(`[AgentLLM] Agent completed after ${round} rounds, ${toolCallsCount} tool calls`);

            const executionTimeMs = Date.now() - startTime;

            // Update draft with agent metadata if we have a draft
            if (context.draftResult?.draftId) {
                const DraftPurchaseRequest = require('../models/DraftPurchaseRequest');
                await DraftPurchaseRequest.findByIdAndUpdate(context.draftResult.draftId, {
                    agentRunMetadata: {
                        modelUsed: OPENROUTER_MODEL,
                        toolCallsCount,
                        executionTimeMs,
                    },
                });
            }

            return {
                success: true,
                message: message.content,
                draftId: context.draftResult?.draftId,
                draftNumber: context.draftResult?.draftNumber,
                summary: {
                    itemsEvaluated: context.reorderPlan?.totals?.itemsEvaluated || 0,
                    itemsIncluded: context.reorderPlan?.totals?.itemsIncluded || 0,
                    itemsDeferred: context.reorderPlan?.totals?.itemsDeferred || 0,
                    totalCostIncluded: context.reorderPlan?.totals?.totalCostIncluded || 0,
                    requiredApproverRole: context.routingResult?.requiredApproverRole || 'unknown',
                },
                agentMetadata: {
                    rounds: round,
                    toolCallsCount,
                    executionTimeMs,
                    modelUsed: OPENROUTER_MODEL,
                },
            };
        }
    }

    // If we exceed max rounds, something is wrong
    throw new Error(`Agent exceeded maximum rounds (${MAX_TOOL_ROUNDS})`);
};

/**
 * Run agent without LLM (direct tool execution for testing/fallback)
 * @param {string} userId - User ID
 * @param {number} budgetCap - Budget cap
 * @returns {Promise<Object>} - Agent result
 */
const runReorderAgentDirect = async (userId, budgetCap = REORDER_BUDGET_CAP) => {
    const startTime = Date.now();
    logger.info(`[AgentDirect] Running direct reorder agent for user ${userId}...`);

    const context = { userId, budgetCap };

    try {
        // Step 1: Get low stock items
        const lowStockItems = await executeTool('getLowStockItems', {}, context);

        if (lowStockItems.length === 0) {
            return {
                success: true,
                message: 'No low-stock items found in general stores inventory.',
                draftId: null,
                draftNumber: null,
                summary: {
                    itemsEvaluated: 0,
                    itemsIncluded: 0,
                    itemsDeferred: 0,
                    totalCostIncluded: 0,
                    requiredApproverRole: null,
                },
            };
        }

        // Step 2: Compute reorder plan
        const plan = await executeTool('computeReorderPlan', {
            items: lowStockItems,
            budgetCap,
        }, context);

        // Step 3: Generate explanation text
        const explanationText = `Automated reorder draft generated for ${plan.totals.itemsIncluded} low-stock items in general stores. ` +
            `Total estimated cost: ₹${plan.totals.totalCostIncluded} (within budget cap of ₹${budgetCap}). ` +
            `${plan.totals.itemsDeferred} items deferred due to budget constraints. ` +
            `Items prioritized by urgency score based on stock deficit, priority level, and lead time.`;

        // Step 4: Create draft
        const draftResult = await executeTool('createDraftPurchaseRequest', {
            plan,
            explanationText,
        }, context);

        // Step 5: Route for approval
        const routingResult = await executeTool('routeForApproval', {
            draftId: draftResult.draftId,
            totalCostAll: plan.totals.totalCostAll,
        }, context);

        // Step 6: Notify approver
        const notifyMessage = `A new inventory reorder draft (${draftResult.draftNumber}) requires your approval. ` +
            `${plan.totals.itemsIncluded} items totaling ₹${plan.totals.totalCostIncluded}.`;

        await executeTool('notifyApprover', {
            requiredApproverRole: routingResult.requiredApproverRole,
            message: notifyMessage,
            draftId: draftResult.draftId,
        }, context);

        // Step 7: Write audit log
        await executeTool('writeAuditLog', {
            draftId: draftResult.draftId,
            itemCodesAccessed: lowStockItems.map(i => i.itemCode),
            itemsEvaluated: plan.totals.itemsEvaluated,
            itemsIncluded: plan.totals.itemsIncluded,
            itemsDeferred: plan.totals.itemsDeferred,
            totalCostAll: plan.totals.totalCostAll,
            totalCostIncluded: plan.totals.totalCostIncluded,
            requiredApproverRole: routingResult.requiredApproverRole,
        }, context);

        const executionTimeMs = Date.now() - startTime;

        // Update draft with metadata
        const DraftPurchaseRequest = require('../models/DraftPurchaseRequest');
        await DraftPurchaseRequest.findByIdAndUpdate(draftResult.draftId, {
            agentRunMetadata: {
                modelUsed: 'direct_execution',
                toolCallsCount: 6,
                executionTimeMs,
            },
        });

        return {
            success: true,
            message: `Reorder draft ${draftResult.draftNumber} created successfully. ${plan.totals.itemsIncluded} items included.`,
            draftId: draftResult.draftId,
            draftNumber: draftResult.draftNumber,
            summary: {
                itemsEvaluated: plan.totals.itemsEvaluated,
                itemsIncluded: plan.totals.itemsIncluded,
                itemsDeferred: plan.totals.itemsDeferred,
                totalCostIncluded: plan.totals.totalCostIncluded,
                requiredApproverRole: routingResult.requiredApproverRole,
            },
            agentMetadata: {
                rounds: 1,
                toolCallsCount: 6,
                executionTimeMs,
                modelUsed: 'direct_execution',
            },
        };
    } catch (error) {
        logger.error(`[AgentDirect] Error: ${error.message}`);
        throw error;
    }
};

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    runReorderAgent,
    runReorderAgentDirect,
    OPENROUTER_MODEL,
};
