const mongoose = require('mongoose');
const { BLOOD_GROUPS, GENDERS } = require('../config/constants');

/**
 * Patient Model
 * Represents patient demographics and medical information
 */

const patientSchema = new mongoose.Schema(
    {
        patientId: {
            type: String,
            unique: true,
        },
        firstName: {
            type: String,
            required: [true, 'First name is required'],
            trim: true,
        },
        lastName: {
            type: String,
            required: [true, 'Last name is required'],
            trim: true,
        },
        dateOfBirth: {
            type: Date,
            required: [true, 'Date of birth is required'],
        },
        gender: {
            type: String,
            enum: GENDERS,
            required: [true, 'Gender is required'],
        },
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
        },
        address: {
            street: { type: String, trim: true },
            city: { type: String, trim: true },
            state: { type: String, trim: true },
            pincode: { type: String, trim: true },
        },
        emergencyContact: {
            name: { type: String, trim: true },
            relationship: { type: String, trim: true },
            phone: { type: String, trim: true },
        },
        bloodGroup: {
            type: String,
            enum: BLOOD_GROUPS,
        },
        allergies: [{ type: String, trim: true }],
        // Structured allergy alerts for safety checking
        allergyAlerts: [{
            allergen: { type: String, required: true, trim: true },
            allergenType: {
                type: String,
                enum: ['drug', 'food', 'environmental', 'contrast', 'other'],
                default: 'drug'
            },
            severity: {
                type: String,
                enum: ['mild', 'moderate', 'severe', 'life-threatening'],
                default: 'moderate'
            },
            reaction: { type: String, trim: true },
            verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            verifiedAt: { type: Date },
            isActive: { type: Boolean, default: true }
        }],
        medicalHistory: [{ type: String, trim: true }],
        insuranceDetails: {
            provider: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'InsuranceProvider',
            },
            policyNumber: { type: String, trim: true },
            validTill: { type: Date },
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for faster queries
patientSchema.index({ patientId: 1 });
patientSchema.index({ phone: 1 });
patientSchema.index({ email: 1 });
patientSchema.index({ firstName: 'text', lastName: 'text' });

// Auto-generate patientId before saving
patientSchema.pre('save', async function (next) {
    if (this.isNew) {
        const count = await mongoose.model('Patient').countDocuments();
        this.patientId = `PAT${String(count + 1).padStart(6, '0')}`;
    }
    next();
});

// Get full name virtual
patientSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// Get age virtual
patientSchema.virtual('age').get(function () {
    if (!this.dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
});

// Ensure virtuals are included in JSON
patientSchema.set('toJSON', { virtuals: true });
patientSchema.set('toObject', { virtuals: true });

const Patient = mongoose.model('Patient', patientSchema);

module.exports = Patient;
