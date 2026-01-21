/**
 * Seed Script for Emergency Order Sets
 * Creates sample trauma, cardiac, and stroke protocols
 * 
 * Usage: node scripts/seed-order-sets.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const OrderSet = require('../models/OrderSet');
const LabTestMaster = require('../models/LabTestMaster');
const RadiologyMaster = require('../models/RadiologyMaster');
const Medicine = require('../models/Medicine');
const User = require('../models/User');
const DrugInteraction = require('../models/DrugInteraction');

const seedOrderSets = async () => {
    try {
        await connectDB();
        console.log('Connected to database');

        // Find an admin user for createdBy
        let adminUser = await User.findOne({ role: 'admin' });
        if (!adminUser) {
            adminUser = await User.findOne({ role: 'doctor' });
        }
        if (!adminUser) {
            console.log('No admin or doctor user found. Creating a placeholder...');
            // We'll use null and handle it
        }

        const createdById = adminUser?._id || null;

        // Get some existing lab tests, radiology tests, and medicines
        const labTests = await LabTestMaster.find({ isActive: true }).limit(10);
        const radiologyTests = await RadiologyMaster.find({ isActive: true }).limit(10);
        const medicines = await Medicine.find({ isActive: true }).limit(15);

        console.log(`Found ${labTests.length} lab tests, ${radiologyTests.length} radiology tests, ${medicines.length} medicines`);

        // If no data exists, create placeholder order sets
        if (labTests.length === 0 && radiologyTests.length === 0 && medicines.length === 0) {
            console.log('No master data found. Creating order sets with empty arrays...');
        }

        // Clear existing order sets
        await OrderSet.deleteMany({});
        console.log('Cleared existing order sets');

        // =====================================
        // TRAUMA PROTOCOL
        // =====================================
        const traumaOrderSet = new OrderSet({
            orderSetCode: 'TRAUMA-MAJOR-01',
            name: 'Major Trauma Protocol',
            type: 'trauma',
            description: 'Comprehensive order set for major trauma cases including motor vehicle accidents, falls, and penetrating injuries',
            triageLevel: ['critical', 'urgent'],
            labTests: labTests.slice(0, 5).map((test, idx) => ({
                test: test._id,
                priority: idx < 3 ? 'stat' : 'urgent',
                notes: idx === 0 ? 'Baseline CBC' : (idx === 1 ? 'Crossmatch if needed' : null),
            })),
            radiologyTests: radiologyTests.slice(0, 3).map((test, idx) => ({
                test: test._id,
                priority: 'stat',
                notes: idx === 0 ? 'Portable if unstable' : null,
            })),
            medications: medicines.slice(0, 4).map((med, idx) => ({
                medicine: med._id,
                dosage: idx === 0 ? '1000ml' : (idx === 1 ? '4mg' : '1g'),
                route: idx === 0 ? 'IV' : (idx === 1 ? 'IV' : 'IM'),
                frequency: idx === 0 ? 'stat then prn' : (idx === 1 ? 'q4h prn' : 'once'),
                duration: idx < 2 ? 'Until stable' : 'Single dose',
                priority: 'stat',
                instructions: idx === 0 ? 'Wide open initially for resuscitation' : null,
            })),
            procedures: [
                { name: 'IV Access', description: 'Two large bore IVs (16-18G)', priority: 'stat' },
                { name: 'Foley Catheter', description: 'Insert if no contraindication', priority: 'urgent' },
                { name: 'NG Tube', description: 'Consider if abdominal trauma', priority: 'routine' },
            ],
            nursingInstructions: [
                'Monitor vitals q15min',
                'Maintain C-spine precautions until cleared',
                'Document all fluid I/O',
                'Glasgow Coma Scale q30min',
                'Notify physician if SBP < 90 or HR > 120',
            ],
            monitoringInstructions: [
                'Continuous cardiac monitoring',
                'Pulse oximetry',
                'Urine output hourly',
            ],
            isActive: true,
            version: 1,
            createdBy: createdById,
        });

        if (createdById) {
            traumaOrderSet.createdBy = createdById;
        }

        // =====================================
        // CARDIAC - ACS PROTOCOL
        // =====================================
        const cardiacOrderSet = new OrderSet({
            orderSetCode: 'CARDIAC-ACS-01',
            name: 'Acute Coronary Syndrome Protocol',
            type: 'cardiac',
            description: 'Order set for suspected acute coronary syndrome including STEMI, NSTEMI, and unstable angina',
            triageLevel: ['critical', 'urgent'],
            labTests: labTests.slice(2, 6).map((test, idx) => ({
                test: test._id,
                priority: 'stat',
                notes: idx === 0 ? 'Troponin - repeat in 3 hours' : null,
            })),
            radiologyTests: radiologyTests.slice(0, 2).map(test => ({
                test: test._id,
                priority: 'stat',
                notes: 'Portable CXR preferred',
            })),
            medications: medicines.slice(4, 9).map((med, idx) => ({
                medicine: med._id,
                dosage: idx === 0 ? '325mg' : (idx === 1 ? '0.4mg' : '5000 units'),
                route: idx === 0 ? 'PO' : (idx === 1 ? 'SL' : 'IV'),
                frequency: idx === 0 ? 'once' : (idx === 1 ? 'q5min x 3' : 'once'),
                duration: 'Single dose',
                priority: 'stat',
                instructions: idx === 0 ? 'Chew if possible' : (idx === 1 ? 'May repeat x 3' : 'Hold if bleeding'),
            })),
            procedures: [
                { name: '12-Lead ECG', description: 'Within 10 minutes of arrival', priority: 'stat' },
                { name: 'IV Access', description: 'Two peripheral IVs', priority: 'stat' },
                { name: 'Cardiac Enzymes', description: 'Serial troponins', priority: 'stat' },
            ],
            nursingInstructions: [
                'Continuous cardiac monitoring',
                'Oxygen to maintain SpO2 > 94%',
                'Complete bed rest',
                'NPO except medications',
                'Call cardiology if STEMI criteria met',
            ],
            monitoringInstructions: [
                'Serial ECGs q30min x 3',
                'Vital signs q15min',
                'Pain scale assessment',
            ],
            isActive: true,
            version: 1,
            createdBy: createdById,
        });

        // =====================================
        // STROKE PROTOCOL
        // =====================================
        const strokeOrderSet = new OrderSet({
            orderSetCode: 'STROKE-ACUTE-01',
            name: 'Acute Stroke Protocol',
            type: 'stroke',
            description: 'Time-critical order set for suspected acute ischemic or hemorrhagic stroke',
            triageLevel: ['critical'],
            labTests: labTests.slice(0, 4).map((test, idx) => ({
                test: test._id,
                priority: 'stat',
                notes: idx === 0 ? 'For tPA eligibility' : null,
            })),
            radiologyTests: radiologyTests.slice(0, 2).map((test, idx) => ({
                test: test._id,
                priority: 'stat',
                notes: idx === 0 ? 'Non-contrast CT head STAT - r/o hemorrhage' : 'CTA if indicated',
            })),
            medications: medicines.slice(8, 12).map((med, idx) => ({
                medicine: med._id,
                dosage: idx === 0 ? '0.9mg/kg' : '10mg',
                route: 'IV',
                frequency: 'once',
                duration: 'Single dose',
                priority: 'stat',
                instructions: idx === 0 ? 'Max 90mg, 10% bolus then infusion' : null,
            })),
            procedures: [
                { name: 'NIH Stroke Scale', description: 'Complete NIHSS assessment', priority: 'stat' },
                { name: 'IV Access', description: 'Two large bore IVs', priority: 'stat' },
                { name: 'Blood Glucose', description: 'Point of care glucose', priority: 'stat' },
            ],
            nursingInstructions: [
                'Nothing by mouth (NPO)',
                'Elevate head of bed 30 degrees',
                'Neuro checks q15min',
                'Strict BP management per protocol',
                'Document time last known well (LKW)',
            ],
            monitoringInstructions: [
                'Continuous cardiac monitoring',
                'BP q5min during tPA, then q15min',
                'Neurological status q15min',
            ],
            isActive: true,
            version: 1,
            createdBy: createdById,
        });

        // =====================================
        // SEPSIS PROTOCOL
        // =====================================
        const sepsisOrderSet = new OrderSet({
            orderSetCode: 'SEPSIS-01',
            name: 'Sepsis Bundle Protocol',
            type: 'sepsis',
            description: 'Early goal-directed therapy for severe sepsis and septic shock',
            triageLevel: ['critical', 'urgent'],
            labTests: labTests.slice(1, 6).map((test, idx) => ({
                test: test._id,
                priority: 'stat',
                notes: idx === 0 ? 'Lactate - repeat in 2 hours' : (idx === 1 ? 'Blood cultures x 2 sites' : null),
            })),
            radiologyTests: radiologyTests.slice(0, 1).map(test => ({
                test: test._id,
                priority: 'stat',
                notes: 'Chest X-ray for source',
            })),
            medications: medicines.slice(10, 14).map((med, idx) => ({
                medicine: med._id,
                dosage: idx === 0 ? '30ml/kg' : '1g',
                route: 'IV',
                frequency: idx === 0 ? 'over 30min' : 'q8h',
                duration: idx === 0 ? 'Initial bolus' : '7-14 days',
                priority: 'stat',
                instructions: idx === 0 ? 'Crystalloid fluid resuscitation' : 'Broad spectrum antibiotics within 1 hour',
            })),
            procedures: [
                { name: 'Blood Cultures', description: '2 sets from different sites before antibiotics', priority: 'stat' },
                { name: 'Central Line', description: 'Consider if vasopressors needed', priority: 'urgent' },
                { name: 'Foley Catheter', description: 'For urine output monitoring', priority: 'stat' },
            ],
            nursingInstructions: [
                'Strict I/O monitoring',
                'Hourly urine output - target > 0.5ml/kg/hr',
                'Monitor for fluid overload',
                'Notify physician if MAP < 65',
            ],
            monitoringInstructions: [
                'Continuous cardiac monitoring',
                'Central venous pressure if available',
                'Lactate clearance every 2-4 hours',
            ],
            isActive: true,
            version: 1,
            createdBy: createdById,
        });

        // Save all order sets
        const savedOrderSets = await Promise.all([
            traumaOrderSet.save(),
            cardiacOrderSet.save(),
            strokeOrderSet.save(),
            sepsisOrderSet.save(),
        ]);

        console.log('\n✅ Order Sets Created:');
        savedOrderSets.forEach(os => {
            console.log(`   - ${os.name} (${os.orderSetCode})`);
        });

        // =====================================
        // SEED SAMPLE DRUG INTERACTIONS
        // =====================================
        if (medicines.length >= 4) {
            await DrugInteraction.deleteMany({});

            const interactions = [
                {
                    drug1: medicines[0]._id,
                    drug2: medicines[1]._id,
                    drug1GenericName: medicines[0].genericName?.toLowerCase(),
                    drug2GenericName: medicines[1].genericName?.toLowerCase(),
                    severity: 'major',
                    interactionType: 'Increased bleeding risk',
                    description: 'Concurrent use increases risk of bleeding complications.',
                    mechanism: 'Additive anticoagulant effects',
                    recommendation: 'Monitor for signs of bleeding. Consider dose adjustment.',
                    source: 'Manual',
                },
                {
                    drug1: medicines[2]._id,
                    drug2: medicines[3]._id,
                    drug1GenericName: medicines[2].genericName?.toLowerCase(),
                    drug2GenericName: medicines[3].genericName?.toLowerCase(),
                    severity: 'moderate',
                    interactionType: 'Reduced efficacy',
                    description: 'Drug absorption may be reduced when taken together.',
                    mechanism: 'Chelation in GI tract',
                    recommendation: 'Separate administration by at least 2 hours.',
                    source: 'Manual',
                },
            ];

            await DrugInteraction.insertMany(interactions);
            console.log('\n✅ Sample Drug Interactions Created: 2');
        }

        console.log('\n🎉 Seed completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }
};

seedOrderSets();
