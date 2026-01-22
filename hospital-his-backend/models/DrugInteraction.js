const mongoose = require('mongoose');

/**
 * DrugInteraction Model
 * 
 * Master table for known drug-drug interactions.
 * Used to check safety at prescription, dispense, and MAR stages.
 * 
 * CLINICAL CONTEXT:
 * - Major interactions can cause serious harm and should block dispense
 * - Moderate interactions require clinical judgement
 * - Minor interactions are informational
 */

const drugInteractionSchema = new mongoose.Schema(
    {
        // Drug pair - order-independent (handled by service logic)
        drug1: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Medicine',
            required: [true, 'First drug is required'],
        },
        drug2: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Medicine',
            required: [true, 'Second drug is required'],
        },

        // Severity classification
        severity: {
            type: String,
            enum: ['major', 'moderate', 'minor'],
            required: [true, 'Severity is required'],
        },

        // Clinical details
        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
        },
        clinicalEffect: {
            type: String,
            trim: true,
            // e.g., "Increased bleeding risk", "Serotonin syndrome"
        },
        mechanism: {
            type: String,
            trim: true,
            // e.g., "CYP3A4 inhibition", "Additive QT prolongation"
        },
        recommendation: {
            type: String,
            trim: true,
            // e.g., "Avoid combination", "Monitor INR closely"
        },

        // Management options
        managementOptions: [{
            option: String,
            details: String,
        }],

        // Clinical evidence level
        evidenceLevel: {
            type: String,
            enum: ['established', 'probable', 'suspected', 'theoretical'],
            default: 'probable',
        },

        // Documentation reference
        references: [{
            source: String, // e.g., "Micromedex", "UpToDate", "FDA"
            url: String,
        }],

        // Active status
        isActive: {
            type: Boolean,
            default: true,
        },

        // Audit
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for efficient lookup (both directions)
drugInteractionSchema.index({ drug1: 1, drug2: 1 }, { unique: true });
drugInteractionSchema.index({ drug2: 1, drug1: 1 });
drugInteractionSchema.index({ severity: 1 });
drugInteractionSchema.index({ isActive: 1 });

/**
 * Static method to find interactions for a list of medicine IDs.
 * Checks both directions (drug1↔drug2) for each pair.
 * 
 * @param {Array} medicineIds - Array of Medicine ObjectIds
 * @returns {Array} - Array of interaction objects
 */
drugInteractionSchema.statics.findInteractionsForMedicines = async function(medicineIds) {
    if (!medicineIds || medicineIds.length < 2) {
        return [];
    }

    // Find all interactions where both drugs are in the list
    const interactions = await this.find({
        isActive: true,
        $or: [
            { drug1: { $in: medicineIds }, drug2: { $in: medicineIds } },
        ]
    })
    .populate('drug1', 'name genericName')
    .populate('drug2', 'name genericName');

    return interactions;
};

/**
 * Static method to check interaction between two specific drugs.
 * 
 * @param {ObjectId} drugAId - First drug ID
 * @param {ObjectId} drugBId - Second drug ID
 * @returns {Object|null} - Interaction object or null
 */
drugInteractionSchema.statics.checkPairInteraction = async function(drugAId, drugBId) {
    const interaction = await this.findOne({
        isActive: true,
        $or: [
            { drug1: drugAId, drug2: drugBId },
            { drug1: drugBId, drug2: drugAId },
        ]
    })
    .populate('drug1', 'name genericName')
    .populate('drug2', 'name genericName');

    return interaction;
};

/**
 * Pre-save: Ensure drug1 < drug2 (ObjectId comparison) for consistency.
 * This prevents duplicate entries like (A,B) and (B,A).
 */
drugInteractionSchema.pre('save', function(next) {
    if (this.isNew || this.isModified('drug1') || this.isModified('drug2')) {
        const d1 = this.drug1.toString();
        const d2 = this.drug2.toString();
        
        // Swap if drug1 > drug2 to maintain consistent ordering
        if (d1 > d2) {
            const temp = this.drug1;
            this.drug1 = this.drug2;
            this.drug2 = temp;
        }

        // Prevent self-interaction
        if (d1 === d2) {
            return next(new Error('A drug cannot interact with itself'));
        }
    }
    next();
});

const DrugInteraction = mongoose.model('DrugInteraction', drugInteractionSchema);

module.exports = DrugInteraction;
