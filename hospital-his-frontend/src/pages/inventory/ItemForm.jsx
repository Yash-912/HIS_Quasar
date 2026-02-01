/**
 * Item Form Component
 * Form for creating/editing inventory items
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import inventoryManagerService from '../../services/inventoryManager.service';
import './ItemForm.css';

const ItemForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id && id !== 'new';

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [categories, setCategories] = useState([]);
    const [locations, setLocations] = useState([]);
    const [reduceQty, setReduceQty] = useState('');
    const [reduceReason, setReduceReason] = useState('Manual adjustment for testing');
    const [processingStock, setProcessingStock] = useState(false);

    const [formData, setFormData] = useState({
        itemCode: '',
        itemName: '',
        description: '',
        category: '',
        subCategory: '',
        uom: 'Piece',
        reorderLevel: 10,
        maxStockLevel: 100,
        batchTracking: false,
        expiryTracking: false,
        defaultLocation: '',
        specifications: '',
        // Policy fields for reorder agent
        policyCategory: 'general_stores',
        policyMinLevel: 10,
        policyTargetLevel: 50,
        policyUnitCost: 100,
        policyMaxOrderQty: 100,
        policyPriority: 3,
        policyLeadTimeDays: 7,
    });

    const uomOptions = [
        'Piece', 'Box', 'Pack', 'Carton', 'Kg', 'Gram', 'Liter', 'ML',
        'Meter', 'Roll', 'Sheet', 'Set', 'Pair', 'Dozen', 'Unit'
    ];

    useEffect(() => {
        fetchCategories();
        fetchLocations();
        if (isEditMode) {
            fetchItem();
        }
    }, [id]);

    const fetchCategories = async () => {
        try {
            const response = await inventoryManagerService.getCategories();
            setCategories(response?.data || response || []);
        } catch (err) {
            console.error('Failed to fetch categories:', err);
        }
    };

    const fetchLocations = async () => {
        try {
            const response = await inventoryManagerService.getLocations();
            setLocations(response?.data || response || []);
        } catch (err) {
            console.error('Failed to fetch locations:', err);
        }
    };

    const fetchItem = async () => {
        try {
            setLoading(true);
            const response = await inventoryManagerService.getItem(id);
            const item = response?.data || response;
            if (item) {
                setFormData({
                    itemCode: item.itemCode || '',
                    itemName: item.itemName || '',
                    description: item.description || '',
                    category: item.category?._id || item.category || '',
                    subCategory: item.subCategory?._id || item.subCategory || '',
                    uom: item.uom || 'Piece',
                    reorderLevel: item.reorderLevel || 10,
                    maxStockLevel: item.maxStockLevel || 100,
                    batchTracking: item.batchTracking || false,
                    expiryTracking: item.expiryTracking || false,
                    defaultLocation: item.defaultLocation?._id || item.defaultLocation || '',
                    specifications: item.specifications || '',
                    // Policy fields
                    policyCategory: item.policyCategory || 'general_stores',
                    policyMinLevel: item.policy?.minLevel || 10,
                    policyTargetLevel: item.policy?.targetLevel || 50,
                    policyUnitCost: item.policy?.unitCost || 100,
                    policyMaxOrderQty: item.policy?.maxOrderQty || 100,
                    policyPriority: item.policy?.priority || 3,
                    policyLeadTimeDays: item.policy?.leadTimeDays || 7,
                });
            }
        } catch (err) {
            setError('Failed to load item');
            console.error('Fetch item error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Basic validation
        if (!formData.itemCode.trim()) {
            setError('Item Code is required');
            return;
        }
        if (!formData.itemName.trim()) {
            setError('Item Name is required');
            return;
        }
        if (!formData.category) {
            setError('Category is required');
            return;
        }

        try {
            setSaving(true);
            setError(null);

            const dataToSend = {
                ...formData,
                reorderLevel: parseInt(formData.reorderLevel) || 0,
                maxStockLevel: parseInt(formData.maxStockLevel) || 0,
                // Add policy fields for reorder agent
                policyCategory: formData.policyCategory,
                policy: {
                    minLevel: parseInt(formData.policyMinLevel) || 0,
                    targetLevel: parseInt(formData.policyTargetLevel) || 0,
                    unitCost: parseFloat(formData.policyUnitCost) || 0,
                    maxOrderQty: parseInt(formData.policyMaxOrderQty) || 100,
                    priority: parseInt(formData.policyPriority) || 3,
                    leadTimeDays: parseInt(formData.policyLeadTimeDays) || 7,
                },
            };

            // Remove flat policy fields (we send nested policy object)
            delete dataToSend.policyMinLevel;
            delete dataToSend.policyTargetLevel;
            delete dataToSend.policyUnitCost;
            delete dataToSend.policyMaxOrderQty;
            delete dataToSend.policyPriority;
            delete dataToSend.policyLeadTimeDays;

            // Remove empty optional fields
            if (!dataToSend.subCategory) delete dataToSend.subCategory;
            if (!dataToSend.defaultLocation) delete dataToSend.defaultLocation;
            // Don't send specifications as string - it's a Map type in backend
            delete dataToSend.specifications;

            if (isEditMode) {
                await inventoryManagerService.updateItem(id, dataToSend);
                alert('Item updated successfully!');
            } else {
                await inventoryManagerService.createItem(dataToSend);
                alert('Item created successfully!');
            }

            navigate('/inventory/items');
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to save item';
            setError(errorMsg);
            console.error('Save error:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleReduceStock = async () => {
        if (!reduceQty || parseInt(reduceQty) <= 0) {
            alert('Please enter a valid quantity');
            return;
        }

        if (!window.confirm(`Are you sure you want to reduce stock by ${reduceQty} units? This cannot be undone.`)) {
            return;
        }

        try {
            setProcessingStock(true);
            await inventoryManagerService.reduceStock(id, parseInt(reduceQty), reduceReason);
            alert('Stock consumed successfully!');
            setReduceQty('');
            // Refresh item data
            fetchItem();
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to reduce stock';
            alert(errorMsg);
        } finally {
            setProcessingStock(false);
        }
    };

    if (loading) {
        return <div className="loading-container">Loading item...</div>;
    }

    return (
        <div className="item-form-page">
            <header className="page-header">
                <div className="header-left">
                    <button className="back-btn" onClick={() => navigate('/inventory/items')}>
                        ← Back
                    </button>
                    <div>
                        <h1>{isEditMode ? 'Edit Item' : 'Add New Item'}</h1>
                        <p>{isEditMode ? 'Update inventory item details' : 'Create a new inventory item'}</p>
                    </div>
                </div>
            </header>

            {error && (
                <div className="error-banner">
                    {error}
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="item-form">
                <section className="form-section">
                    <h2>Basic Information</h2>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="itemCode">Item Code *</label>
                            <input
                                type="text"
                                id="itemCode"
                                name="itemCode"
                                value={formData.itemCode}
                                onChange={handleChange}
                                placeholder="e.g., INV-001"
                                required
                                disabled={isEditMode}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="itemName">Item Name *</label>
                            <input
                                type="text"
                                id="itemName"
                                name="itemName"
                                value={formData.itemName}
                                onChange={handleChange}
                                placeholder="Enter item name"
                                required
                            />
                        </div>
                    </div>
                </section>

                <section className="form-section">
                    <h2>Classification</h2>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="category">Category *</label>
                            <select
                                id="category"
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select Category</option>
                                {categories.map(cat => (
                                    <option key={cat._id} value={cat._id}>
                                        {cat.categoryName}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="uom">Unit of Measure *</label>
                            <select
                                id="uom"
                                name="uom"
                                value={formData.uom}
                                onChange={handleChange}
                                required
                            >
                                {uomOptions.map(uom => (
                                    <option key={uom} value={uom}>{uom}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="defaultLocation">Default Location</label>
                            <select
                                id="defaultLocation"
                                name="defaultLocation"
                                value={formData.defaultLocation}
                                onChange={handleChange}
                            >
                                <option value="">Select Location</option>
                                {locations.map(loc => (
                                    <option key={loc._id} value={loc._id}>
                                        {loc.locationName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </section>

                <section className="form-section">
                    <h2>🤖 Reorder Policy (for AI Agent)</h2>
                    <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        These settings are used by the AI reorder agent to calculate urgency and recommend order quantities.
                    </p>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="policyCategory">Policy Category *</label>
                            <select
                                id="policyCategory"
                                name="policyCategory"
                                value={formData.policyCategory}
                                onChange={handleChange}
                                required
                            >
                                <option value="general_stores">General Stores</option>
                                <option value="pharmacy">Pharmacy</option>
                                <option value="equipment">Equipment</option>
                                <option value="consumables">Consumables</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="policyPriority">Priority (1-5)</label>
                            <select
                                id="policyPriority"
                                name="policyPriority"
                                value={formData.policyPriority}
                                onChange={handleChange}
                            >
                                <option value="1">1 - Low</option>
                                <option value="2">2 - Below Normal</option>
                                <option value="3">3 - Normal</option>
                                <option value="4">4 - High</option>
                                <option value="5">5 - Critical</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="policyMinLevel">Min Level (triggers reorder)</label>
                            <input
                                type="number"
                                id="policyMinLevel"
                                name="policyMinLevel"
                                value={formData.policyMinLevel}
                                onChange={handleChange}
                                min="0"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="policyTargetLevel">Target Level (order up to)</label>
                            <input
                                type="number"
                                id="policyTargetLevel"
                                name="policyTargetLevel"
                                value={formData.policyTargetLevel}
                                onChange={handleChange}
                                min="0"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="policyUnitCost">Unit Cost (₹)</label>
                            <input
                                type="number"
                                id="policyUnitCost"
                                name="policyUnitCost"
                                value={formData.policyUnitCost}
                                onChange={handleChange}
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="policyMaxOrderQty">Max Order Qty</label>
                            <input
                                type="number"
                                id="policyMaxOrderQty"
                                name="policyMaxOrderQty"
                                value={formData.policyMaxOrderQty}
                                onChange={handleChange}
                                min="1"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="policyLeadTimeDays">Lead Time (days)</label>
                            <input
                                type="number"
                                id="policyLeadTimeDays"
                                name="policyLeadTimeDays"
                                value={formData.policyLeadTimeDays}
                                onChange={handleChange}
                                min="0"
                            />
                        </div>
                    </div>
                </section>

                <section className="form-section">
                    <h2>Additional Information</h2>
                    <div className="form-group full-width">
                        <label htmlFor="specifications">Specifications</label>
                        <textarea
                            id="specifications"
                            name="specifications"
                            value={formData.specifications}
                            onChange={handleChange}
                            placeholder="Enter technical specifications or notes"
                            rows="4"
                        />
                    </div>
                </section>

                {isEditMode && (
                    <section className="form-section" style={{ border: '1px solid #fee2e2', backgroundColor: '#fff1f2' }}>
                        <h2 style={{ color: '#991b1b' }}>📉 Manual Stock Reduction (Demo/Testing)</h2>
                        <p style={{ color: '#b91c1c', fontSize: '0.875rem', marginBottom: '1rem' }}>
                            Use this to manually lower stock levels without creating a formal stock issue. Useful for triggering low-stock scenarios for the AI agent.
                        </p>
                        <div className="form-grid">
                            <div className="form-group">
                                <label htmlFor="reduceQty" style={{ color: '#7f1d1d' }}>Qty to Reduce</label>
                                <input
                                    type="number"
                                    id="reduceQty"
                                    value={reduceQty}
                                    onChange={(e) => setReduceQty(e.target.value)}
                                    placeholder="Qty"
                                    min="1"
                                    style={{ borderColor: '#fca5a5' }}
                                />
                            </div>
                            <div className="form-group full-width">
                                <label htmlFor="reduceReason" style={{ color: '#7f1d1d' }}>Reason</label>
                                <input
                                    type="text"
                                    id="reduceReason"
                                    value={reduceReason}
                                    onChange={(e) => setReduceReason(e.target.value)}
                                    placeholder="Reason for reduction"
                                    style={{ borderColor: '#fca5a5' }}
                                />
                            </div>
                            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={handleReduceStock}
                                    disabled={processingStock || !reduceQty}
                                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                    style={{ height: '42px', width: '100%' }}
                                >
                                    {processingStock ? 'Processing...' : 'Reduce Stock'}
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                <div className="form-actions">
                    <button
                        type="button"
                        className="btn-cancel"
                        onClick={() => navigate('/inventory/items')}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn-save"
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : (isEditMode ? 'Update Item' : 'Create Item')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ItemForm;
