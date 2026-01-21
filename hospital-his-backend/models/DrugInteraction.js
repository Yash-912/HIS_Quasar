const mongoose = require('mongoose');

/**
 * DrugInteraction Model
 * Represents drug-drug interaction rules for safety checking
 */

const SEVERITY_LEVELS = {
    CRITICAL: 'critical',
    MAJOR: 'major',
    MODERATE: 'moderate',
    MINOR: 'minor',
};

const drugInteractionSchema = new mongoose.Schema(
    {
        // Interacting drugs (order doesn't matter)
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

        // Can also match by generic name for broader coverage
        drug1GenericName: {
            type: String,
            trim: true,
            lowercase: true,
        },
        drug2GenericName: {
            type: String,
            trim: true,
            lowercase: true,
        },

        // Severity classification
        severity: {
            type: String,
            enum: Object.values(SEVERITY_LEVELS),
            required: [true, 'Severity level is required'],
        },

        // Interaction details
        interactionType: {
            type: String,
            trim: true,
            required: [true, 'Interaction type is required'],
        },
        description: {
            type: String,
            trim: true,
            required: [true, 'Description is required'],
        },
        mechanism: {
            type: String,
            trim: true,
        },
        clinicalEffects: {
            type: String,
            trim: true,
        },
        recommendation: {
            type: String,
            trim: true,
            required: [true, 'Recommendation is required'],
        },

        // Reference source
        source: {
            type: String,
            trim: true,
            enum: ['FDA', 'Micromedex', 'Lexicomp', 'DrugBank', 'UpToDate', 'Manual', 'Other'],
            default: 'Manual',
        },
        sourceReference: {
            type: String,
            trim: true,
        },

        // Status
        isActive: {
            type: Boolean,
            default: true,
        },

        // Audit
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        lastUpdatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for efficient drug pair lookups (both directions)
drugInteractionSchema.index({ drug1: 1, drug2: 1 });
drugInteractionSchema.index({ drug2: 1, drug1: 1 });
drugInteractionSchema.index({ drug1GenericName: 1, drug2GenericName: 1 });
drugInteractionSchema.index({ severity: 1 });
drugInteractionSchema.index({ isActive: 1 });

// Static method to check interaction between two medicines
drugInteractionSchema.statics.checkInteraction = async function (medicineId1, medicineId2) {
    return this.findOne({
        isActive: true,
        $or: [
            { drug1: medicineId1, drug2: medicineId2 },
            { drug1: medicineId2, drug2: medicineId1 },
        ],
    }).populate('drug1 drug2', 'name genericName');
};

// Static method to check interactions by generic names
drugInteractionSchema.statics.checkInteractionByGenericName = async function (genericName1, genericName2) {
    const name1 = genericName1.toLowerCase();
    const name2 = genericName2.toLowerCase();

    return this.findOne({
        isActive: true,
        $or: [
            { drug1GenericName: name1, drug2GenericName: name2 },
            { drug1GenericName: name2, drug2GenericName: name1 },
        ],
    });
};

// Static method to get all interactions for a medicine
drugInteractionSchema.statics.getInteractionsForMedicine = async function (medicineId) {
    return this.find({
        isActive: true,
        $or: [{ drug1: medicineId }, { drug2: medicineId }],
    })
        .populate('drug1 drug2', 'name genericName')
        .sort({ severity: 1 });
};

// Static method to check multiple medicines for interactions
drugInteractionSchema.statics.checkMultipleMedicines = async function (medicineIds) {
    const interactions = [];

    // Check each pair
    for (let i = 0; i < medicineIds.length; i++) {
        for (let j = i + 1; j < medicineIds.length; j++) {
            const interaction = await this.checkInteraction(medicineIds[i], medicineIds[j]);
            if (interaction) {
                interactions.push(interaction);
            }
        }
    }

    return interactions;
};

const DrugInteraction = mongoose.model('DrugInteraction', drugInteractionSchema);

// Export constants
DrugInteraction.SEVERITY_LEVELS = SEVERITY_LEVELS;

module.exports = DrugInteraction;
