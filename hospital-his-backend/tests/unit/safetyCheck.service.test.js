/**
 * Safety Check Service Unit Tests
 */

const mongoose = require('mongoose');

// Mock the models
jest.mock('../models/Patient');
jest.mock('../models/Medicine');
jest.mock('../models/DrugInteraction');
jest.mock('../models/LabTest');
jest.mock('../models/Radiology');
jest.mock('../models/Prescription');

const Patient = require('../models/Patient');
const Medicine = require('../models/Medicine');
const DrugInteraction = require('../models/DrugInteraction');
const Prescription = require('../models/Prescription');
const LabTest = require('../models/LabTest');
const Radiology = require('../models/Radiology');

const safetyCheckService = require('../services/safetyCheck.service');

describe('SafetyCheckService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('checkAllergies', () => {
        it('should detect allergy match when medicine matches patient allergen', async () => {
            const patientId = new mongoose.Types.ObjectId();
            const medicineId = new mongoose.Types.ObjectId();

            // Mock patient with allergy
            Patient.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    _id: patientId,
                    allergies: ['penicillin'],
                    allergyAlerts: [
                        {
                            allergen: 'aspirin',
                            severity: 'severe',
                            isActive: true,
                        }
                    ],
                }),
            });

            // Mock medicine
            Medicine.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    _id: medicineId,
                    name: 'Penicillin V',
                    genericName: 'penicillin',
                    category: 'antibiotic',
                }),
            });

            const warnings = await safetyCheckService.checkAllergies(patientId, [{ medicine: medicineId }]);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].allergen).toBe('penicillin');
            expect(warnings[0].medicineName).toBe('Penicillin V');
        });

        it('should return empty array when no allergy matches', async () => {
            const patientId = new mongoose.Types.ObjectId();
            const medicineId = new mongoose.Types.ObjectId();

            Patient.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    _id: patientId,
                    allergies: ['shellfish'],
                    allergyAlerts: [],
                }),
            });

            Medicine.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    _id: medicineId,
                    name: 'Ibuprofen',
                    genericName: 'ibuprofen',
                    category: 'nsaid',
                }),
            });

            const warnings = await safetyCheckService.checkAllergies(patientId, [{ medicine: medicineId }]);

            expect(warnings).toHaveLength(0);
        });

        it('should throw error when patient not found', async () => {
            Patient.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(null),
            });

            await expect(safetyCheckService.checkAllergies('invalid-id', [])).rejects.toThrow('Patient not found');
        });
    });

    describe('checkDrugInteractions', () => {
        it('should detect drug-drug interaction between new medicines', async () => {
            const medicineId1 = new mongoose.Types.ObjectId();
            const medicineId2 = new mongoose.Types.ObjectId();
            const patientId = new mongoose.Types.ObjectId();

            // Mock no existing prescriptions
            Prescription.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue([]),
            });

            // Mock drug interaction check
            DrugInteraction.checkMultipleMedicines = jest.fn().mockResolvedValue([
                {
                    drug1: { _id: medicineId1, name: 'Warfarin' },
                    drug2: { _id: medicineId2, name: 'Aspirin' },
                    severity: 'major',
                    interactionType: 'Increased bleeding risk',
                    description: 'Concurrent use increases risk of bleeding',
                    recommendation: 'Monitor closely',
                },
            ]);

            DrugInteraction.checkInteraction = jest.fn().mockResolvedValue(null);

            const warnings = await safetyCheckService.checkDrugInteractions(
                [{ medicine: medicineId1 }, { medicine: medicineId2 }],
                patientId
            );

            expect(warnings).toHaveLength(1);
            expect(warnings[0].severity).toBe('major');
            expect(warnings[0].drug1Name).toBe('Warfarin');
        });

        it('should return empty array when no interactions found', async () => {
            const patientId = new mongoose.Types.ObjectId();

            Prescription.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue([]),
            });

            DrugInteraction.checkMultipleMedicines = jest.fn().mockResolvedValue([]);
            DrugInteraction.checkInteraction = jest.fn().mockResolvedValue(null);

            const warnings = await safetyCheckService.checkDrugInteractions(
                [{ medicine: new mongoose.Types.ObjectId() }],
                patientId
            );

            expect(warnings).toHaveLength(0);
        });
    });

    describe('checkDuplicateOrders', () => {
        it('should detect duplicate lab order within 24 hours', async () => {
            const patientId = new mongoose.Types.ObjectId();
            const testId = new mongoose.Types.ObjectId();

            LabTest.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue({
                    _id: new mongoose.Types.ObjectId(),
                    testNumber: 'LAB20260121-001',
                    test: { testName: 'CBC' },
                    createdAt: new Date(),
                }),
            });

            Radiology.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue(null),
            });

            Prescription.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue(null),
            });

            const warnings = await safetyCheckService.checkDuplicateOrders(
                patientId,
                new mongoose.Types.ObjectId(),
                { labTests: [{ test: testId }], radiologyTests: [], medications: [] }
            );

            expect(warnings).toHaveLength(1);
            expect(warnings[0].orderType).toBe('lab');
            expect(warnings[0].itemName).toBe('CBC');
        });
    });

    describe('runFullSafetyCheck', () => {
        it('should aggregate all safety warnings', async () => {
            const patientId = new mongoose.Types.ObjectId();
            const emergencyId = new mongoose.Types.ObjectId();

            // Mock patient with allergy
            Patient.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    _id: patientId,
                    allergies: ['morphine'],
                    allergyAlerts: [
                        { allergen: 'morphine', severity: 'severe', isActive: true }
                    ],
                }),
            });

            // Mock medicine that matches allergy
            Medicine.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    _id: new mongoose.Types.ObjectId(),
                    name: 'Morphine Sulfate',
                    genericName: 'morphine',
                    category: 'opioid',
                }),
            });

            // No prescriptions
            Prescription.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue([]),
            });

            DrugInteraction.checkMultipleMedicines = jest.fn().mockResolvedValue([]);
            DrugInteraction.checkInteraction = jest.fn().mockResolvedValue(null);

            // No duplicates
            LabTest.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue(null),
            });
            Radiology.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue(null),
            });
            Prescription.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue(null),
            });

            const orderSet = {
                medications: [{ medicine: new mongoose.Types.ObjectId() }],
                labTests: [],
                radiologyTests: [],
            };

            const result = await safetyCheckService.runFullSafetyCheck(patientId, emergencyId, orderSet);

            expect(result.hasWarnings).toBe(true);
            expect(result.allergyWarnings.length).toBeGreaterThan(0);
            expect(result.hasCriticalWarnings).toBe(true);
        });
    });

    describe('validateOverrideAuthority', () => {
        it('should allow doctor to override', () => {
            const user = { role: 'doctor' };
            expect(safetyCheckService.validateOverrideAuthority(user, 'moderate')).toBe(true);
        });

        it('should allow admin to override', () => {
            const user = { role: 'admin' };
            expect(safetyCheckService.validateOverrideAuthority(user, 'critical')).toBe(true);
        });

        it('should deny nurse from overriding', () => {
            const user = { role: 'nurse' };
            expect(safetyCheckService.validateOverrideAuthority(user, 'moderate')).toBe(false);
        });

        it('should return false for null user', () => {
            expect(safetyCheckService.validateOverrideAuthority(null, 'moderate')).toBe(false);
        });
    });
});
