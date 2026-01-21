import React, { useState } from 'react';
import './SafetyWarningsModal.css';

/**
 * Safety Warnings Modal Component
 * Displays allergy, drug interaction, and duplicate order warnings
 * Requires override reason to proceed
 */
const SafetyWarningsModal = ({
    safetyChecks,
    orderSetName,
    onConfirm,
    onCancel,
    loading
}) => {
    const [overrideReason, setOverrideReason] = useState('');
    const [confirmChecked, setConfirmChecked] = useState(false);

    const { allergyWarnings, drugInteractionWarnings, duplicateOrderWarnings, hasCriticalWarnings } = safetyChecks;

    const hasAllergy = allergyWarnings?.length > 0;
    const hasInteractions = drugInteractionWarnings?.length > 0;
    const hasDuplicates = duplicateOrderWarnings?.length > 0;

    const canProceed = confirmChecked && overrideReason.trim().length >= 10;

    const handleSubmit = () => {
        if (canProceed) {
            onConfirm(overrideReason);
        }
    };

    const getSeverityClass = (severity) => {
        switch (severity) {
            case 'life-threatening':
            case 'critical':
                return 'severity-critical';
            case 'severe':
            case 'major':
                return 'severity-major';
            case 'moderate':
                return 'severity-moderate';
            default:
                return 'severity-minor';
        }
    };

    return (
        <div className="safety-modal-overlay">
            <div className={`safety-modal ${hasCriticalWarnings ? 'critical' : ''}`}>
                <div className="safety-header">
                    <div className="header-icon">
                        {hasCriticalWarnings ? '🚨' : '⚠️'}
                    </div>
                    <h2>Safety Alerts</h2>
                    <p className="header-subtitle">
                        Review the following warnings before applying <strong>{orderSetName}</strong>
                    </p>
                </div>

                <div className="safety-content">
                    {/* Allergy Warnings */}
                    {hasAllergy && (
                        <div className="warning-section allergy">
                            <h3>💉 Allergy Warnings</h3>
                            <ul className="warning-list">
                                {allergyWarnings.map((warning, idx) => (
                                    <li key={idx} className={getSeverityClass(warning.severity)}>
                                        <div className="warning-header">
                                            <span className="warning-badge">{warning.severity}</span>
                                            <span className="warning-title">
                                                Patient allergic to: <strong>{warning.allergen}</strong>
                                            </span>
                                        </div>
                                        <div className="warning-details">
                                            <span>Medication: {warning.medicineName}</span>
                                            {warning.reaction && (
                                                <span>Reaction: {warning.reaction}</span>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Drug Interaction Warnings */}
                    {hasInteractions && (
                        <div className="warning-section interaction">
                            <h3>💊 Drug Interactions</h3>
                            <ul className="warning-list">
                                {drugInteractionWarnings.map((warning, idx) => (
                                    <li key={idx} className={getSeverityClass(warning.severity)}>
                                        <div className="warning-header">
                                            <span className="warning-badge">{warning.severity}</span>
                                            <span className="warning-title">
                                                {warning.drug1Name} + {warning.drug2Name}
                                            </span>
                                        </div>
                                        <div className="warning-details">
                                            <span>{warning.description}</span>
                                            {warning.recommendation && (
                                                <span className="recommendation">
                                                    Recommendation: {warning.recommendation}
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Duplicate Order Warnings */}
                    {hasDuplicates && (
                        <div className="warning-section duplicate">
                            <h3>📋 Duplicate Orders</h3>
                            <ul className="warning-list">
                                {duplicateOrderWarnings.map((warning, idx) => (
                                    <li key={idx} className="severity-minor">
                                        <div className="warning-header">
                                            <span className="warning-badge">duplicate</span>
                                            <span className="warning-title">{warning.itemName}</span>
                                        </div>
                                        <div className="warning-details">
                                            <span>
                                                Existing order: {warning.existingOrderNumber}
                                            </span>
                                            <span>
                                                Created: {new Date(warning.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="safety-override">
                    <div className="override-notice">
                        <span className="notice-icon">📝</span>
                        <p>
                            To proceed with this order set, you must provide a clinical justification.
                            This action will be logged in the audit trail.
                        </p>
                    </div>

                    <div className="override-form">
                        <label htmlFor="overrideReason">Override Reason *</label>
                        <textarea
                            id="overrideReason"
                            value={overrideReason}
                            onChange={(e) => setOverrideReason(e.target.value)}
                            placeholder="Enter clinical justification for overriding safety warnings (minimum 10 characters)"
                            rows={3}
                        />

                        <label className="confirm-checkbox">
                            <input
                                type="checkbox"
                                checked={confirmChecked}
                                onChange={(e) => setConfirmChecked(e.target.checked)}
                            />
                            <span>
                                I acknowledge the safety warnings and take clinical responsibility for this override
                            </span>
                        </label>
                    </div>
                </div>

                <div className="safety-footer">
                    <button className="cancel-btn" onClick={onCancel} disabled={loading}>
                        Cancel
                    </button>
                    <button
                        className={`proceed-btn ${hasCriticalWarnings ? 'critical' : ''}`}
                        onClick={handleSubmit}
                        disabled={!canProceed || loading}
                    >
                        {loading ? 'Processing...' : 'Proceed with Override'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SafetyWarningsModal;
