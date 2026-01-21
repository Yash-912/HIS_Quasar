import React from 'react';
import './OrderSetPreview.css';

/**
 * Order Set Preview Component
 * Shows detailed preview of an order set before applying
 */
const OrderSetPreview = ({
    orderSet,
    previewData,
    loading,
    applyLoading,
    onApply,
    onClose
}) => {
    if (loading) {
        return (
            <div className="preview-modal-overlay">
                <div className="preview-modal">
                    <div className="preview-loading">
                        <div className="spinner"></div>
                        <p>Loading preview...</p>
                    </div>
                </div>
            </div>
        );
    }

    const { safetyChecks, estimatedItems } = previewData || {};
    const hasWarnings = safetyChecks?.hasWarnings;

    return (
        <div className="preview-modal-overlay" onClick={onClose}>
            <div className="preview-modal" onClick={e => e.stopPropagation()}>
                <div className="preview-header">
                    <h2>{orderSet.name}</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="preview-content">
                    <p className="preview-description">{orderSet.description}</p>

                    {/* Summary Stats */}
                    <div className="preview-stats">
                        <div className="stat-item">
                            <span className="stat-icon">🧪</span>
                            <span className="stat-value">{estimatedItems?.labTests || 0}</span>
                            <span className="stat-label">Lab Tests</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-icon">📷</span>
                            <span className="stat-value">{estimatedItems?.radiologyTests || 0}</span>
                            <span className="stat-label">Radiology</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-icon">💊</span>
                            <span className="stat-value">{estimatedItems?.medications || 0}</span>
                            <span className="stat-label">Medications</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-icon">📋</span>
                            <span className="stat-value">{estimatedItems?.procedures || 0}</span>
                            <span className="stat-label">Procedures</span>
                        </div>
                    </div>

                    {/* Lab Tests Section */}
                    {orderSet.labTests?.length > 0 && (
                        <div className="preview-section">
                            <h4>🧪 Laboratory Tests</h4>
                            <ul className="preview-list">
                                {orderSet.labTests.map((item, idx) => (
                                    <li key={idx} className={`priority-${item.priority}`}>
                                        <span className="item-name">
                                            {item.test?.testName || 'Lab Test'}
                                        </span>
                                        <span className={`priority-badge ${item.priority}`}>
                                            {item.priority}
                                        </span>
                                        {item.notes && <span className="item-notes">{item.notes}</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Radiology Section */}
                    {orderSet.radiologyTests?.length > 0 && (
                        <div className="preview-section">
                            <h4>📷 Radiology Investigations</h4>
                            <ul className="preview-list">
                                {orderSet.radiologyTests.map((item, idx) => (
                                    <li key={idx} className={`priority-${item.priority}`}>
                                        <span className="item-name">
                                            {item.test?.testName || 'Radiology Test'}
                                        </span>
                                        <span className={`priority-badge ${item.priority}`}>
                                            {item.priority}
                                        </span>
                                        {item.notes && <span className="item-notes">{item.notes}</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Medications Section */}
                    {orderSet.medications?.length > 0 && (
                        <div className="preview-section">
                            <h4>💊 Medications</h4>
                            <ul className="preview-list medications">
                                {orderSet.medications.map((item, idx) => (
                                    <li key={idx} className={`priority-${item.priority}`}>
                                        <div className="med-header">
                                            <span className="item-name">
                                                {item.medicine?.name || 'Medication'}
                                            </span>
                                            <span className={`priority-badge ${item.priority}`}>
                                                {item.priority}
                                            </span>
                                        </div>
                                        <div className="med-details">
                                            <span>{item.dosage}</span>
                                            <span>{item.route}</span>
                                            <span>{item.frequency}</span>
                                        </div>
                                        {item.instructions && (
                                            <span className="item-notes">{item.instructions}</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Procedures Section */}
                    {orderSet.procedures?.length > 0 && (
                        <div className="preview-section">
                            <h4>📋 Procedures</h4>
                            <ul className="preview-list">
                                {orderSet.procedures.map((item, idx) => (
                                    <li key={idx}>
                                        <span className="item-name">{item.name}</span>
                                        {item.description && (
                                            <span className="item-notes">{item.description}</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Nursing Instructions */}
                    {orderSet.nursingInstructions?.length > 0 && (
                        <div className="preview-section">
                            <h4>👩‍⚕️ Nursing Instructions</h4>
                            <ul className="preview-list simple">
                                {orderSet.nursingInstructions.map((item, idx) => (
                                    <li key={idx}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="preview-footer">
                    {hasWarnings && (
                        <div className="warning-notice">
                            ⚠️ Safety warnings detected - review required
                        </div>
                    )}
                    <div className="preview-actions">
                        <button className="cancel-btn" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            className="apply-btn"
                            onClick={onApply}
                            disabled={applyLoading}
                        >
                            {applyLoading ? 'Applying...' : hasWarnings ? 'Review Warnings' : 'Apply Order Set'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderSetPreview;
