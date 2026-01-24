const mongoose = require('mongoose');
const { APPOINTMENT_STATUS } = require('../config/constants');
require('./Counter');

/**
 * Appointment Model
 * Represents OPD appointments and follow-ups
 */

const appointmentSchema = new mongoose.Schema(
    {
        appointmentNumber: {
            type: String,
            unique: true,
        },
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Patient',
            required: [true, 'Patient is required'],
        },
        doctor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Doctor is required'],
        },
        department: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Department',
            required: [true, 'Department is required'],
        },
        type: {
            type: String,
            default: 'General',
        },
        scheduledDate: {
            type: Date,
            required: [true, 'Scheduled date is required'],
        },
        scheduledTime: {
            type: String,
        },
        status: {
            type: String,
            enum: Object.values(APPOINTMENT_STATUS),
            default: APPOINTMENT_STATUS.SCHEDULED,
        },
        tokenNumber: {
            type: Number,
        },
        chiefComplaint: {
            type: String,
            trim: true,
        },
        notes: {
            type: String,
            trim: true,
        },
        diagnosis: {
            type: String,
            trim: true,
        },
        prescription: [{
            name: String,
            dosage: String,
            frequency: String,
            duration: String,
        }],
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
appointmentSchema.index({ appointmentNumber: 1 });
appointmentSchema.index({ patient: 1 });
appointmentSchema.index({ doctor: 1 });
appointmentSchema.index({ scheduledDate: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ department: 1, scheduledDate: 1 });

// Auto-generate appointmentNumber before saving
appointmentSchema.pre('save', async function (next) {
    if (this.isNew && !this.appointmentNumber) {
        const now = new Date();
        const apiDateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const counterId = `appointment_${apiDateStr}`;
        const Counter = mongoose.model('Counter');

        try {
            // calculatedSeq will hold the final sequence number to use
            let calculatedSeq;

            // 1. Try to atomically increment the counter
            // We use 'new: true' to get the updated document
            // We DO NOT use 'upsert: true' immediately because we need to handle the case
            // where the counter doesn't exist yet but appointments MIGHT exist (mid-day deployment).
            let counter = await Counter.findByIdAndUpdate(
                counterId,
                { $inc: { seq: 1 } },
                { new: true }
            );

            if (!counter) {
                // 2. Counter doesn't exist for today. Initialize it correctly.
                // Count existing appointments for this day first to avoid duplicates.
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

                const existingCount = await mongoose.model('Appointment').countDocuments({
                    createdAt: {
                        $gte: startOfDay,
                        $lt: endOfDay,
                    },
                });

                // Set initial sequence to existingCount + 1
                const initialSeq = existingCount + 1;

                try {
                    // Create the counter. usage of create() ensures only one concurrent request succeeds due to _id uniqueness
                    const newCounter = await Counter.create({
                        _id: counterId,
                        seq: initialSeq
                    });
                    calculatedSeq = newCounter.seq;
                } catch (err) {
                    // 3. Race condition: Another request created the counter just now.
                    // Fallback to atomic increment.
                    if (err.code === 11000) {
                        counter = await Counter.findByIdAndUpdate(
                            counterId,
                            { $inc: { seq: 1 } },
                            { new: true }
                        );
                        calculatedSeq = counter.seq;
                    } else {
                        throw err;
                    }
                }
            } else {
                calculatedSeq = counter.seq;
            }

            this.appointmentNumber = `APT${apiDateStr}${String(calculatedSeq).padStart(4, '0')}`;
            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
