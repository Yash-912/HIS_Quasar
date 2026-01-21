/**
 * Order Set Controller
 * Handles HTTP requests for order set operations
 */

const orderSetService = require('../services/orderSet.service');
const { successResponse, errorResponse, createdResponse, notFoundResponse, badRequestResponse } = require('../utils/response');

/**
 * Get all active order sets
 * GET /api/order-sets
 */
const getAllOrderSets = async (req, res) => {
    try {
        const filters = {
            type: req.query.type,
            triageLevel: req.query.triageLevel,
        };

        const orderSets = await orderSetService.getAllOrderSets(filters);

        return successResponse(res, { orderSets }, 'Order sets retrieved successfully');
    } catch (error) {
        console.error('Error fetching order sets:', error);
        return errorResponse(res, 'Failed to fetch order sets', 500);
    }
};

/**
 * Get order set by ID
 * GET /api/order-sets/:id
 */
const getOrderSetById = async (req, res) => {
    try {
        const orderSet = await orderSetService.getOrderSetById(req.params.id);

        if (!orderSet) {
            return notFoundResponse(res, 'Order set');
        }

        return successResponse(res, { orderSet }, 'Order set retrieved successfully');
    } catch (error) {
        console.error('Error fetching order set:', error);
        return errorResponse(res, 'Failed to fetch order set', 500);
    }
};

/**
 * Get order sets by type
 * GET /api/order-sets/type/:type
 */
const getOrderSetsByType = async (req, res) => {
    try {
        const orderSets = await orderSetService.getOrderSetsByType(req.params.type);

        return successResponse(res, { orderSets }, 'Order sets retrieved successfully');
    } catch (error) {
        console.error('Error fetching order sets by type:', error);
        return errorResponse(res, 'Failed to fetch order sets', 500);
    }
};

/**
 * Preview order set application with safety checks
 * POST /api/order-sets/:id/preview
 * Body: { patientId, emergencyId }
 */
const previewOrderSet = async (req, res) => {
    try {
        const { patientId, emergencyId } = req.body;

        if (!patientId || !emergencyId) {
            return badRequestResponse(res, 'Patient ID and Emergency ID are required');
        }

        const preview = await orderSetService.previewOrderSet(
            req.params.id,
            patientId,
            emergencyId
        );

        return successResponse(res, preview, 'Order set preview generated');
    } catch (error) {
        console.error('Error generating preview:', error);
        return errorResponse(res, 'Failed to generate preview', 500);
    }
};

/**
 * Apply order set to a patient
 * POST /api/order-sets/:id/apply
 * Body: { 
 *   patientId, 
 *   emergencyId, 
 *   overrides: { confirmed, reason, skipDuplicates: [] },
 *   modifications: []
 * }
 */
const applyOrderSet = async (req, res) => {
    try {
        const { patientId, emergencyId, overrides, modifications } = req.body;

        if (!patientId || !emergencyId) {
            return badRequestResponse(res, 'Patient ID and Emergency ID are required');
        }

        const result = await orderSetService.applyOrderSetToPatient(
            req.params.id,
            patientId,
            emergencyId,
            req.user,
            overrides || {},
            modifications || []
        );

        // If requires override, return 200 with warning flag
        if (result.requiresOverride) {
            return successResponse(res, result, result.message);
        }

        // Return created orders
        return createdResponse(res, result, 'Order set applied successfully');
    } catch (error) {
        console.error('Error applying order set:', error);
        return errorResponse(res, 'Failed to apply order set', 500);
    }
};

/**
 * Get applied order sets for an emergency
 * GET /api/order-sets/applied/emergency/:emergencyId
 */
const getAppliedOrderSets = async (req, res) => {
    try {
        const appliedOrderSets = await orderSetService.getAppliedOrderSets(
            req.params.emergencyId
        );

        return successResponse(res, { appliedOrderSets }, 'Applied order sets retrieved');
    } catch (error) {
        console.error('Error fetching applied order sets:', error);
        return errorResponse(res, 'Failed to fetch applied order sets', 500);
    }
};

/**
 * Get applied order set by ID
 * GET /api/order-sets/applied/:id
 */
const getAppliedOrderSetById = async (req, res) => {
    try {
        const appliedOrderSet = await orderSetService.getAppliedOrderSetById(
            req.params.id
        );

        if (!appliedOrderSet) {
            return notFoundResponse(res, 'Applied order set');
        }

        return successResponse(res, { appliedOrderSet }, 'Applied order set retrieved');
    } catch (error) {
        console.error('Error fetching applied order set:', error);
        return errorResponse(res, 'Failed to fetch applied order set', 500);
    }
};

/**
 * Create a new order set (admin only)
 * POST /api/order-sets
 */
const createOrderSet = async (req, res) => {
    try {
        const orderSet = await orderSetService.createOrderSet(req.body, req.user);

        return createdResponse(res, { orderSet }, 'Order set created successfully');
    } catch (error) {
        console.error('Error creating order set:', error);
        return errorResponse(res, 'Failed to create order set', 500);
    }
};

/**
 * Update an order set (admin only)
 * PUT /api/order-sets/:id
 */
const updateOrderSet = async (req, res) => {
    try {
        const orderSet = await orderSetService.updateOrderSet(
            req.params.id,
            req.body,
            req.user
        );

        return successResponse(res, { orderSet }, 'Order set updated successfully');
    } catch (error) {
        console.error('Error updating order set:', error);
        return errorResponse(res, 'Failed to update order set', 500);
    }
};

/**
 * Delete (deactivate) an order set (admin only)
 * DELETE /api/order-sets/:id
 */
const deleteOrderSet = async (req, res) => {
    try {
        const orderSet = await orderSetService.deactivateOrderSet(
            req.params.id,
            req.user
        );

        if (!orderSet) {
            return notFoundResponse(res, 'Order set');
        }

        return successResponse(res, null, 'Order set deactivated successfully');
    } catch (error) {
        console.error('Error deactivating order set:', error);
        return errorResponse(res, 'Failed to deactivate order set', 500);
    }
};

module.exports = {
    getAllOrderSets,
    getOrderSetById,
    getOrderSetsByType,
    previewOrderSet,
    applyOrderSet,
    getAppliedOrderSets,
    getAppliedOrderSetById,
    createOrderSet,
    updateOrderSet,
    deleteOrderSet,
};

