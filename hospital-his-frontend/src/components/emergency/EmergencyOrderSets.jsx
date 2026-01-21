import React, { useState, useEffect } from 'react';
import orderSetService from '../../services/orderSet.service';
import OrderSetPreview from './OrderSetPreview';
import SafetyWarningsModal from './SafetyWarningsModal';
import './EmergencyOrderSets.css';

/**
 * Emergency Order Sets Component
 * Displays available order sets for quick application during emergency treatment
 */
const EmergencyOrderSets = ({ patientId, emergencyId, patientName, onOrdersCreated }) => {
    const [orderSets, setOrderSets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedOrderSet, setSelectedOrderSet] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [showSafetyModal, setShowSafetyModal] = useState(false);
    const [applyLoading, setApplyLoading] = useState(false);
    const [appliedOrderSets, setAppliedOrderSets] = useState([]);

    // Order set type colors
    const typeColors = {
        trauma: { bg: '#fef2f2', border: '#ef4444', text: '#b91c1c', icon: '🩹' },
        cardiac: { bg: '#fef3c7', border: '#f59e0b', text: '#b45309', icon: '❤️' },
        stroke: { bg: '#ede9fe', border: '#8b5cf6', text: '#6d28d9', icon: '🧠' },
        sepsis: { bg: '#fce7f3', border: '#ec4899', text: '#be185d', icon: '🦠' },
        respiratory: { bg: '#e0f2fe', border: '#0ea5e9', text: '#0369a1', icon: '🫁' },
        pediatric: { bg: '#d1fae5', border: '#10b981', text: '#047857', icon: '👶' },
        custom: { bg: '#f3f4f6', border: '#6b7280', text: '#374151', icon: '📋' },
    };

    // Fetch available order sets
    useEffect(() => {
        fetchOrderSets();
        if (emergencyId) {
            fetchAppliedOrderSets();
        }
    }, [emergencyId]);

    const fetchOrderSets = async () => {
        try {
            setLoading(true);
            const response = await orderSetService.getAll();
            if (response.success) {
                setOrderSets(response.data.orderSets || []);
            }
        } catch (err) {
            setError('Failed to load order sets');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAppliedOrderSets = async () => {
        try {
            const response = await orderSetService.getAppliedByEmergency(emergencyId);
            if (response.success) {
                setAppliedOrderSets(response.data.appliedOrderSets || []);
            }
        } catch (err) {
            console.error('Failed to fetch applied order sets:', err);
        }
    };

    // Handle order set selection - show preview
    const handleSelectOrderSet = async (orderSet) => {
        setSelectedOrderSet(orderSet);
        setPreviewLoading(true);

        try {
            const response = await orderSetService.preview(orderSet._id, patientId, emergencyId);
            if (response.success) {
                setPreviewData(response.data);

                // If there are safety warnings, show the safety modal
                if (response.data.safetyChecks?.hasWarnings) {
                    setShowSafetyModal(true);
                }
            }
        } catch (err) {
            setError('Failed to preview order set');
            console.error(err);
        } finally {
            setPreviewLoading(false);
        }
    };

    // Handle apply order set
    const handleApplyOrderSet = async (overrides = {}) => {
        if (!selectedOrderSet || !patientId || !emergencyId) return;

        setApplyLoading(true);
        try {
            const response = await orderSetService.apply(selectedOrderSet._id, {
                patientId,
                emergencyId,
                overrides,
            });

            if (response.success) {
                if (response.data.requiresOverride) {
                    // Safety warnings need to be addressed
                    setPreviewData(prev => ({
                        ...prev,
                        safetyChecks: response.data.safetyChecks,
                    }));
                    setShowSafetyModal(true);
                } else {
                    // Order set applied successfully
                    setSelectedOrderSet(null);
                    setPreviewData(null);
                    setShowSafetyModal(false);
                    fetchAppliedOrderSets();

                    if (onOrdersCreated) {
                        onOrdersCreated(response.data);
                    }

                    alert(`✅ Order set applied successfully!\n\nCreated:\n- ${response.data.createdOrders.labTests.length} lab orders\n- ${response.data.createdOrders.radiologyTests.length} radiology orders\n- ${response.data.createdOrders.prescriptions.length} prescriptions`);
                }
            }
        } catch (err) {
            setError('Failed to apply order set');
            console.error(err);
        } finally {
            setApplyLoading(false);
        }
    };

    // Handle override confirmation
    const handleOverrideConfirm = (reason) => {
        handleApplyOrderSet({
            confirmed: true,
            reason,
            skipDuplicates: previewData?.safetyChecks?.duplicateOrderWarnings?.map(w => w.itemId) || [],
        });
    };

    // Close preview
    const handleClosePreview = () => {
        setSelectedOrderSet(null);
        setPreviewData(null);
        setShowSafetyModal(false);
    };

    // Group order sets by type
    const groupedOrderSets = orderSets.reduce((acc, os) => {
        const type = os.type || 'custom';
        if (!acc[type]) acc[type] = [];
        acc[type].push(os);
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="order-sets-loading">
                <div className="spinner"></div>
                <p>Loading order sets...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="order-sets-error">
                <p>⚠️ {error}</p>
                <button onClick={fetchOrderSets}>Retry</button>
            </div>
        );
    }

    return (
        <div className="emergency-order-sets">
            <div className="order-sets-header">
                <h3>🚨 Emergency Order Sets</h3>
                <p className="patient-info">
                    Patient: <strong>{patientName || 'Unknown'}</strong>
                </p>
            </div>

            {/* Applied Order Sets */}
            {appliedOrderSets.length > 0 && (
                <div className="applied-order-sets">
                    <h4>Recently Applied</h4>
                    <div className="applied-list">
                        {appliedOrderSets.map(aos => (
                            <div key={aos._id} className={`applied-item ${aos.status}`}>
                                <span className="applied-name">{aos.orderSet?.name}</span>
                                <span className="applied-status">{aos.status}</span>
                                <span className="applied-time">
                                    {new Date(aos.appliedAt).toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Order Sets Grid */}
            <div className="order-sets-grid">
                {Object.entries(groupedOrderSets).map(([type, sets]) => (
                    <div key={type} className="order-set-group">
                        <h4 className="group-title" style={{ color: typeColors[type]?.text }}>
                            {typeColors[type]?.icon} {type.charAt(0).toUpperCase() + type.slice(1)}
                        </h4>
                        <div className="group-cards">
                            {sets.map(orderSet => (
                                <div
                                    key={orderSet._id}
                                    className="order-set-card"
                                    style={{
                                        backgroundColor: typeColors[type]?.bg,
                                        borderColor: typeColors[type]?.border,
                                    }}
                                    onClick={() => handleSelectOrderSet(orderSet)}
                                >
                                    <div className="card-header">
                                        <span className="card-icon">{typeColors[type]?.icon}</span>
                                        <h5>{orderSet.name}</h5>
                                    </div>
                                    <p className="card-description">{orderSet.description}</p>
                                    <div className="card-stats">
                                        <span>🧪 {orderSet.labTests?.length || 0} Labs</span>
                                        <span>📷 {orderSet.radiologyTests?.length || 0} Radiology</span>
                                        <span>💊 {orderSet.medications?.length || 0} Meds</span>
                                    </div>
                                    <button
                                        className="apply-btn"
                                        style={{ backgroundColor: typeColors[type]?.border }}
                                    >
                                        Apply Now
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Order Set Preview Modal */}
            {selectedOrderSet && previewData && !showSafetyModal && (
                <OrderSetPreview
                    orderSet={selectedOrderSet}
                    previewData={previewData}
                    loading={previewLoading}
                    applyLoading={applyLoading}
                    onApply={() => handleApplyOrderSet()}
                    onClose={handleClosePreview}
                />
            )}

            {/* Safety Warnings Modal */}
            {showSafetyModal && previewData?.safetyChecks && (
                <SafetyWarningsModal
                    safetyChecks={previewData.safetyChecks}
                    orderSetName={selectedOrderSet?.name}
                    onConfirm={handleOverrideConfirm}
                    onCancel={() => setShowSafetyModal(false)}
                    loading={applyLoading}
                />
            )}
        </div>
    );
};

export default EmergencyOrderSets;
