/**
 * Mock data seeder (ADDITIVE, never deletes).
 *
 * Fills every collection that has fewer documents than its target with
 * schema-valid mock data. Existing data is only read (for references).
 *
 * Run:  node scripts/seedMock.js
 */
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- random utils
let seed = 20261101;
const rnd = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const chance = (p) => rnd() < p;
const DAY = 86400000;
const daysAgo = (n) => new Date(Date.now() - n * DAY - int(0, 80000000));
const daysAhead = (n) => new Date(Date.now() + n * DAY + int(0, 80000000));
const pad = (n, w = 4) => String(n).padStart(w, '0');

// ---------------------------------------------------------------- word lists
const FIRST_M = ['Aarav', 'Vihaan', 'Arjun', 'Rohan', 'Karan', 'Rahul', 'Amit', 'Sanjay', 'Vikram', 'Manoj', 'Deepak', 'Nikhil', 'Suresh', 'Ravi', 'Imran', 'Farhan', 'Joseph', 'Daniel'];
const FIRST_F = ['Ananya', 'Diya', 'Priya', 'Neha', 'Pooja', 'Kavita', 'Sunita', 'Meera', 'Anjali', 'Riya', 'Shreya', 'Fatima', 'Ayesha', 'Maria', 'Lakshmi', 'Divya', 'Isha', 'Tanvi'];
const LAST = ['Sharma', 'Verma', 'Gupta', 'Patel', 'Singh', 'Kumar', 'Reddy', 'Nair', 'Iyer', 'Joshi', 'Mehta', 'Khan', 'Shah', 'Das', 'Bose', 'Pillai', 'Menon', 'Desai', 'Kulkarni', 'Chopra'];
const CITIES = ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai'];
const STATES = ['Maharashtra', 'Delhi', 'Karnataka', 'Telangana', 'Tamil Nadu'];
const COMPLAINTS = ['Fever for 3 days', 'Persistent cough', 'Chest pain on exertion', 'Abdominal pain', 'Headache and dizziness', 'Joint pain in knees', 'Skin rash with itching', 'Shortness of breath', 'Back pain', 'Sore throat', 'Nausea and vomiting', 'Fatigue and weakness'];
const DIAGNOSES = ['Viral fever', 'Acute bronchitis', 'Hypertension', 'Type 2 diabetes mellitus', 'Gastritis', 'Migraine', 'Osteoarthritis', 'Allergic dermatitis', 'Upper respiratory tract infection', 'Urinary tract infection', 'Anemia', 'Lower back strain'];
const NOTES = ['Patient stable, continue current plan.', 'Advised rest and hydration.', 'Review after 3 days with reports.', 'Vitals within normal limits.', 'Counselled regarding diet and medication adherence.', 'Monitor for any worsening symptoms.', 'Follow-up recommended in one week.'];
const ALLERGIES = ['Penicillin', 'Sulfa drugs', 'Peanuts', 'Dust', 'Latex', 'Aspirin'];
const HISTORY = ['Hypertension', 'Diabetes', 'Asthma', 'Appendectomy (2015)', 'Thyroid disorder', 'No significant history'];
const COMPANIES = ['MediSupply Co', 'HealthFirst Distributors', 'PharmaLink Ltd', 'CareWell Traders', 'Apex Surgicals', 'LifeLine Medicals'];
const ITEMS = ['Surgical gloves', 'Syringe 5ml', 'IV cannula 20G', 'Cotton roll', 'Face mask N95', 'Gauze pads', 'Bandage 4in', 'Saline set', 'Urine bag', 'Suture 2-0'];

const plain = (x) => (x && typeof x.toObject === 'function' ? x.toObject() : x);
const name = () => { const f = chance(0.5) ? pick(FIRST_M) : pick(FIRST_F); return [f, pick(LAST)]; };
const phone = () => `9${int(100000000, 999999999)}`;

// ---------------------------------------------------------------- targets
// Collections already populated by scripts/seed.js are listed with their seeded counts.
const TARGET = {
    Department: 13, Ward: 11, Bed: 146, Medicine: 12, LabTestMaster: 10, RadiologyMaster: 10,
    TariffCategory: 10, InsuranceProvider: 8,
    Patient: 40, Appointment: 60, EMR: 40, Prescription: 35, VitalSigns: 50,
    Admission: 15, AdmissionRequest: 8, Emergency: 12, Billing: 30, Payment: 25, Insurance: 12,
    Surgery: 10, LabTest: 30, LabReport: 20, Radiology: 20, AuditLog: 60, Notification: 40,
    SystemSettings: 1, SystemConfig: 5, Counter: 0,
};
const DEFAULT_TARGET = 12;
const SKIP = new Set(['Counter']); // maintained by the application itself

// ---------------------------------------------------------------- value generation
const lastSeg = (p) => p.split('.').pop();

function genString(p, t, M) {
    const s = lastSeg(p).toLowerCase();
    const full = p.toLowerCase();
    if (/email/.test(s)) { const [f, l] = name(); return `${f}.${l}${int(1, 99)}@example.com`.toLowerCase(); }
    if (/phone|mobile|contact(number)?$|whatsapp/.test(s)) return phone();
    if (/firstname/.test(s)) return pick(chance(0.5) ? FIRST_M : FIRST_F);
    if (/lastname|surname/.test(s)) return pick(LAST);
    if (/^(full)?name$|patientname|vendorname|suppliername|contactperson|incharge$/.test(s)) {
        if (/vendor|supplier|company|provider/.test(M.modelName.toLowerCase() + full)) return pick(COMPANIES);
        const [f, l] = name(); return `${f} ${l}`;
    }
    if (/city/.test(s)) return pick(CITIES);
    if (/state/.test(s)) return pick(STATES);
    if (/pincode|zip|postal/.test(s)) return String(int(400001, 560100));
    if (/street|address/.test(s)) return `${int(1, 250)}, ${pick(['MG Road', 'Station Road', 'Park Street', 'Lake View', 'Civil Lines'])}`;
    if (/complaint|reason|symptom/.test(s)) return pick(COMPLAINTS);
    if (/diagnos|impression|finding|condition/.test(s)) return pick(DIAGNOSES);
    if (/note|remark|comment|description|summary|instruction|history|treatment|plan|observation|justification|details|text|message|body|content/.test(s)) return pick(NOTES);
    if (/title|subject/.test(s)) return pick(['Routine review', 'Stock alert', 'Pending approval', 'Report ready', 'Follow-up due']);
    if (/url|path|image|file|document|pdf|attachment/.test(s)) return `/uploads/mock/${s}-${int(100, 999)}.pdf`;
    if (/building/.test(s)) return pick(['Main', 'Annex', 'Block B']);
    if (/floor/.test(s)) return pick(['Ground', '1', '2', '3']);
    if (/ip(address)?$/.test(s)) return `10.0.${int(0, 255)}.${int(1, 254)}`;
    if (/unit$/.test(s)) return pick(['mg', 'ml', 'units', 'pcs', 'box']);
    if (/batch/.test(s)) return `BATCH-${int(1000, 9999)}`;
    if (/policy/.test(s)) return `POL${int(1000000, 9999999)}`;
    if (/designation|role$/.test(s)) return pick(['Consultant', 'Senior Staff', 'Associate']);
    if (/specialization|department$/.test(s)) return pick(['General Medicine', 'Cardiology', 'Orthopedics']);
    if (/result|value/.test(s)) return String(int(10, 200));
    if (/manufacturer|vendor|supplier|brand/.test(s)) return pick(COMPANIES);
    if (/code|number|id$|ref|reference|key/.test(s)) return `${M.modelName.slice(0, 3).toUpperCase()}-${int(10000, 99999)}`;
    if (/category|type|status|mode/.test(s)) return pick(['general', 'standard', 'routine']);
    return `Sample ${s}`;
}

function genNumber(p, t) {
    const s = lastSeg(p).toLowerCase();
    const o = t.options || {};
    let v;
    if (/age/.test(s)) v = int(1, 90);
    else if (/pincode/.test(s)) v = int(400001, 560100);
    else if (/percent|discount|rate$|tax|gst/.test(s)) v = int(0, 18);
    else if (/price|amount|cost|total|fee|charge|mrp|salary|balance|paid|due|tariff|basic|net|subtotal|value$/.test(s)) v = int(100, 5000);
    else if (/qty|quantity|count|stock|level|units|beds|capacity|number$|days|duration/.test(s)) v = int(1, 60);
    else if (/score|level|grade|priority|order|sequence|seq/.test(s)) v = int(1, 5);
    else if (/temperature/.test(s)) v = 36 + Math.round(rnd() * 20) / 10;
    else if (/pulse|heart/.test(s)) v = int(62, 98);
    else if (/oxygen|spo2|saturation/.test(s)) v = int(94, 100);
    else if (/weight/.test(s)) v = int(45, 95);
    else if (/height/.test(s)) v = int(150, 188);
    else v = int(1, 100);
    if (o.min !== undefined && v < o.min) v = o.min + int(0, 5);
    if (o.max !== undefined && v > o.max) v = o.max;
    return v;
}

function genDate(p, t) {
    const s = lastSeg(p).toLowerCase();
    const o = t.options || {};
    let d;
    if (/expir|valid|until|due|next|estimated|end|deadline|scheduledfor|target|renew/.test(s)) d = daysAhead(int(20, 300));
    else if (/birth|dob/.test(s)) d = new Date(Date.now() - int(1, 80) * 365 * DAY);
    else d = daysAgo(int(0, 60));
    if (o.min && d < new Date(o.min)) d = new Date(new Date(o.min).getTime() + int(1, 30) * DAY);
    if (o.max && d > new Date(o.max)) d = new Date(o.max);
    return d;
}

// ---------------------------------------------------------------- reference picking
const ROLE_RULES = [
    [/doctor|physician|surgeon|consultant|prescrib|anesth|specialist|attending|referr/, 'doctor'],
    [/nurse|assignedto|handover|administeredby|givenby/, 'nurse'],
    [/pharmac|dispens/, 'pharmacist'],
    [/radiolog/, 'radiologist'],
    [/lab|technician|tech$|performedby|collectedby|sample/, 'lab_tech'],
    [/cashier|billing|biller|receivedby/, 'billing'],
    [/inventory|store|purchas|approv|requestedby|issuedby|receiv/, 'inventory_manager'],
    [/receptionist/, 'receptionist'],
    [/insurance|claim/, 'insurance'],
];

function pickRef(ref, p, ctx) {
    const pool = ctx.pool(ref);
    if (!pool.length) return undefined;
    if (ref === 'User') {
        const s = p.toLowerCase();
        for (const [re, role] of ROLE_RULES) {
            if (re.test(s)) { const c = pool.filter((u) => u.role === role); if (c.length) return pick(c)._id; }
        }
        const staff = pool.filter((u) => u.role !== 'doctor' || chance(0.3));
        return pick(staff.length ? staff : pool)._id;
    }
    return pick(pool)._id;
}

// ---------------------------------------------------------------- schema-driven generator
function genValue(t, p, M, ctx, depth) {
    const o = t.options || {};
    if (t.instance === 'Array') {
        const n = int(1, 2);
        if (t.schema) return Array.from({ length: n }, () => genSchema(t.schema, M, ctx, depth + 1));
        const c = t.caster || {};
        const co = c.options || {};
        if (co.ref) { const v = pickRef(co.ref, p, ctx); return v ? [v] : []; }
        if (c.instance === 'String') {
            if (c.options && c.options.enum && c.options.enum.length) return [pick(c.options.enum)];
            return Array.from({ length: n }, () => genString(p, c, M));
        }
        if (c.instance === 'Number') return Array.from({ length: n }, () => genNumber(p, c));
        return [];
    }
    if (t.$isSingleNested && t.schema) return genSchema(t.schema, M, ctx, depth + 1);
    if (o.ref) return pickRef(o.ref, p, ctx);
    switch (t.instance) {
        case 'ObjectId': {
            const s = lastSeg(p).toLowerCase();
            if (/^(visit|encounter)$/.test(s)) { const a = ctx.pool('Appointment'); return a.length ? pick(a)._id : undefined; }
            return new (require('mongoose').Types.ObjectId)();
        }
        case 'String': {
            if (o.enum && o.enum.length) { const e = o.enum.filter((x) => x !== '' && x != null); return pick(e); }
            let v = genString(p, t, M);
            if (o.match) v = ctx.matchString(o.match, v);
            const mx = Array.isArray(o.maxlength) ? o.maxlength[0] : o.maxlength;
            const mn = Array.isArray(o.minlength) ? o.minlength[0] : o.minlength;
            if (mx && v.length > mx) v = v.slice(0, mx);
            if (mn && v.length < mn) v = `${v} - recorded as part of routine mock data entry`.slice(0, Math.max(mn + 10, v.length));
            return v;
        }
        case 'Number':
            if (o.enum && o.enum.length) return pick(o.enum);
            return genNumber(p, t);
        case 'Boolean': return chance(0.3);
        case 'Date': return genDate(p, t);
        case 'Mixed': return {};
        default: return undefined;
    }
}

function setPath(obj, p, v) {
    const parts = p.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) { cur = cur[parts[i]] = cur[parts[i]] || {}; }
    cur[parts[parts.length - 1]] = v;
}

function genSchema(schema, M, ctx, depth = 0) {
    const out = {};
    schema.eachPath((p, t) => {
        if (['_id', '__v', 'createdAt', 'updatedAt'].includes(p) || p.includes('$')) return;
        if (t.options && t.options.select === false) return;
        const required = !!(t.options && t.options.required);
        if (!required && !chance(0.55)) return;
        if (depth > 2 && !required) return;
        const v = genValue(t, p, M, ctx, depth);
        if (v === undefined) return;
        setPath(out, p, v);
    });
    return out;
}

// ---------------------------------------------------------------- model-specific realism
const apptOf = (ctx) => { const a = ctx.pool('Appointment'); return a.length ? pick(a) : null; };

const FIX = {
    Patient(d, ctx) {
        const female = chance(0.5); const f = pick(female ? FIRST_F : FIRST_M); const l = pick(LAST);
        d.firstName = f; d.lastName = l; d.gender = female ? 'Female' : 'Male';
        d.dateOfBirth = new Date(Date.now() - int(2, 85) * 365 * DAY - int(0, 300) * DAY);
        d.phone = phone(); d.email = `${f}.${l}${int(1, 99)}@example.com`.toLowerCase();
        d.address = { street: `${int(1, 250)} ${pick(['MG Road', 'Park Street', 'Station Road'])}`, city: pick(CITIES), state: pick(STATES), pincode: String(int(400001, 560100)) };
        d.bloodGroup = pick(['A+', 'A-', 'B+', 'B-', 'AB+', 'O+', 'O+', 'O-']);
        d.allergies = chance(0.3) ? [pick(ALLERGIES)] : [];
        d.medicalHistory = [pick(HISTORY)];
        d.emergencyContact = { name: `${pick(FIRST_M)} ${l}`, relationship: pick(['Spouse', 'Father', 'Son', 'Sibling']), phone: phone() };
        delete d.patientId; delete d.idDocument; delete d.referral; delete d.maskedAadhaar; delete d.idProofImagePath;
        const ip = ctx.pool('InsuranceProvider');
        if (ip.length && chance(0.4)) d.insuranceDetails = { provider: pick(ip)._id, policyNumber: `POL${int(1000000, 9999999)}`, validTill: daysAhead(int(60, 500)) };
        else delete d.insuranceDetails;
    },
    Appointment(d, ctx) {
        const docs = ctx.pool('User').filter((u) => u.role === 'doctor');
        const doc = pick(docs);
        d.doctor = doc._id; if (doc.department) d.department = doc.department;
        d.status = pick(['scheduled', 'scheduled', 'checked-in', 'in-consultation', 'completed', 'completed', 'completed', 'pharmacy-cleared', 'cancelled', 'no-show']);
        d.type = pick(['General', 'Follow-up', 'Emergency']);
        d.scheduledDate = chance(0.7) ? daysAgo(int(0, 25)) : daysAhead(int(1, 14));
        d.scheduledTime = `${pad(int(9, 17), 2)}:${pick(['00', '15', '30', '45'])}`;
        d.tokenNumber = int(1, 40); d.chiefComplaint = pick(COMPLAINTS); d.notes = pick(NOTES);
        if (d.status === 'completed' || d.status === 'pharmacy-cleared') d.diagnosis = pick(DIAGNOSES); else delete d.diagnosis;
        delete d.appointmentNumber;
        const rec = ctx.pool('User').filter((u) => u.role === 'receptionist'); if (rec.length) d.createdBy = pick(rec)._id;
        d.prescription = d.status === 'completed' ? [{ name: pick(['Paracetamol 500mg', 'Amoxicillin 500mg', 'Pantoprazole 40mg', 'Cetirizine 10mg']), dosage: '1 tablet', frequency: pick(['OD', 'BD', 'TDS']), duration: `${int(3, 7)} days` }] : [];
    },
    EMR(d, ctx) {
        const a = apptOf(ctx); if (a) { d.patient = a.patient; d.doctor = a.doctor; d.visit = a._id; }
        d.visitModel = 'Appointment'; d.visitType = 'opd'; d.date = daysAgo(int(0, 40));
        d.vitals = { bloodPressure: `${int(105, 140)}/${int(65, 92)}`, pulse: int(62, 98), temperature: 36.4 + Math.round(rnd() * 20) / 10, respiratoryRate: int(14, 20), oxygenSaturation: int(95, 100), weight: int(48, 92), height: int(152, 186) };
        d.vitals.bmi = Math.round((d.vitals.weight / Math.pow(d.vitals.height / 100, 2)) * 10) / 10;
        d.chiefComplaint = pick(COMPLAINTS); d.diagnosis = pick(DIAGNOSES); d.treatment = pick(NOTES);
    },
    Prescription(d, ctx) {
        const a = apptOf(ctx); if (a) { d.patient = a.patient; d.doctor = a.doctor; d.visit = a._id; }
        d.visitModel = 'Appointment'; delete d.prescriptionNumber;
        const meds = ctx.pool('Medicine');
        d.medicines = Array.from({ length: int(1, 3) }, () => ({
            medicine: meds.length ? pick(meds)._id : undefined, dosage: pick(['1 tablet', '2 tablets', '5 ml']),
            frequency: pick(['OD', 'BD', 'TDS']), duration: `${int(3, 10)} days`, instructions: pick(['After food', 'Before food', 'At bedtime']), quantity: int(6, 30),
        }));
        d.isDispensed = chance(0.5);
        if (!d.isDispensed) { delete d.dispensedBy; delete d.dispensedAt; }
    },
    VitalSigns(d, ctx) {
        d.bloodPressure = { systolic: int(105, 145), diastolic: int(65, 95), position: 'sitting' };
        d.pulse = { rate: int(60, 100), rhythm: 'regular' };
        d.temperature = { value: 36.2 + Math.round(rnd() * 25) / 10, unit: 'celsius', site: 'oral' };
        d.respiratoryRate = { rate: int(14, 22), pattern: 'normal' };
        d.oxygenSaturation = { value: int(94, 100), onOxygen: false };
        d.isAbnormal = false; d.isCritical = false;
        delete d.recordNumber;
        d.recordedAt = daysAgo(int(0, 10));
    },
    Billing(d, ctx) {
        const a = apptOf(ctx); if (a) { d.patient = a.patient; d.visit = a._id; }
        d.visitModel = 'Appointment'; d.visitType = 'opd';
        const catalog = [['consultation', 'OPD consultation', 500], ['lab', 'Complete blood count', 350], ['pharmacy', 'Medicines', 640], ['radiology', 'Chest X-ray', 800], ['procedure', 'Dressing', 250]];
        const chosen = catalog.slice(0, int(1, 4));
        d.items = chosen.map(([t, desc, rate]) => ({ itemType: t, description: desc, quantity: 1, rate, amount: rate, discount: 0, tax: 0, netAmount: rate, isBilled: true, billedAt: daysAgo(int(0, 30)) }));
        d.subtotal = d.items.reduce((x, i) => x + i.netAmount, 0);
        d.totalDiscount = chance(0.2) ? 50 : 0; d.totalTax = 0;
        d.grandTotal = d.subtotal - d.totalDiscount;
        d.status = pick(['finalized', 'finalized', 'finalized', 'draft']);
        const state = d.status === 'draft' ? 'pending' : pick(['paid', 'paid', 'partial', 'pending']);
        d.paymentStatus = state;
        d.paidAmount = state === 'paid' ? d.grandTotal : state === 'partial' ? Math.floor(d.grandTotal / 2) : 0;
        d.balanceAmount = d.grandTotal - d.paidAmount;
        d.paymentResponsibility = { patientAmount: d.grandTotal, insuranceAmount: 0 }; d.insuranceStatus = 'none';
        d.billDate = daysAgo(int(0, 30));
        delete d.billNumber; delete d.insuranceClaim; delete d.departmentBills; delete d.discountRequest; delete d.discountApprovedBy; delete d.discountApprovalDate; delete d.discountRejectionReason; delete d.lockedAt; delete d.lockedBy; delete d.auditTrail;
        d.isLocked = false;
    },
    Payment(d, ctx) {
        const b = ctx.pool('Billing').filter((x) => x.paidAmount > 0);
        if (b.length) { const bill = pick(b); d.bill = bill._id; d.patient = bill.patient; d.amount = bill.paidAmount; }
        d.paymentMode = pick(['cash', 'card', 'upi', 'online']);
        d.paymentDetails = d.paymentMode === 'upi' ? { upiId: 'patient@upi', transactionId: `TXN${int(100000, 999999)}` } : d.paymentMode === 'card' ? { cardLast4: String(int(1000, 9999)), transactionId: `TXN${int(100000, 999999)}` } : {};
        d.paymentDate = daysAgo(int(0, 30)); d.isRefunded = false; d.remarks = 'Payment received';
        delete d.refundedAt; delete d.refundReason;
    },
    Notification(d) {
        const items = [['Lab report ready', 'A new lab report is available for review.', '/dashboard/lab-reports'], ['New appointment', 'A new appointment has been booked.', '/dashboard/appointments'], ['Low stock alert', 'Some pharmacy items are below reorder level.', '/dashboard/pharmacy'], ['Bill pending', 'A bill is awaiting payment.', '/dashboard/billing']];
        const [t, m, u] = pick(items); d.title = t; d.message = m; d.actionUrl = u; d.isRead = chance(0.4);
        if (!d.isRead) delete d.readAt;
    },
    Admission(d, ctx) {
        d.admissionDate = daysAgo(int(1, 20));
        d.status = pick(['admitted', 'admitted', 'discharged']);
        if (d.status === 'discharged') d.dischargeDate = new Date(d.admissionDate.getTime() + int(2, 6) * DAY); else delete d.dischargeDate;
        d.diagnosis = pick(DIAGNOSES); delete d.admissionNumber;
    },
};

// ---------------------------------------------------------------- users (explicit, realistic)
const EXTRA_USERS = [
    ['nurse.anita', 'nurse', 'Anita', 'Desai', 'DEPT-GEN'], ['nurse.kiran', 'nurse', 'Kiran', 'Patil', 'DEPT-EMRG'],
    ['nurse.sunil', 'nurse', 'Sunil', 'Mishra', 'DEPT-GEN'], ['nurse.rekha', 'nurse', 'Rekha', 'Nambiar', 'DEPT-PEDS'],
    ['nurse.joseph', 'nurse', 'Joseph', 'Fernandes', 'DEPT-ORTH'], ['headnurse.mary', 'head_nurse', 'Mary', 'Thomas', 'DEPT-GEN'],
    ['reception.sonia', 'receptionist', 'Sonia', 'Kapoor', 'DEPT-ADMN'], ['reception.rahul', 'receptionist', 'Rahul', 'Jain', 'DEPT-ADMN'],
    ['pharma.lata', 'pharmacist', 'Lata', 'Rane', 'DEPT-PHAR'], ['pharma.vijay', 'pharmacist', 'Vijay', 'Kale', 'DEPT-PHAR'],
    ['lab.maya', 'lab_tech', 'Maya', 'Sawant', 'DEPT-LAB'], ['lab.hari', 'lab_tech', 'Hari', 'Prasad', 'DEPT-LAB'],
    ['radio.vivek', 'radiologist', 'Vivek', 'Anand', 'DEPT-RAD'], ['radio.shalini', 'radiologist', 'Shalini', 'Roy', 'DEPT-RAD'],
    ['billing.omkar', 'billing', 'Omkar', 'Pawar', 'DEPT-ADMN'], ['billing.sneha', 'billing', 'Sneha', 'Bhatt', 'DEPT-ADMN'],
    ['insurance.tarun', 'insurance', 'Tarun', 'Saxena', 'DEPT-ADMN'], ['compliance.ritu', 'compliance', 'Ritu', 'Ahuja', 'DEPT-ADMN'],
    ['inventory.manoj', 'inventory_manager', 'Manoj', 'Tiwari', 'DEPT-ADMN'], ['inventory.geeta', 'inventory_manager', 'Geeta', 'Rao', 'DEPT-ADMN'],
];
const PW = { nurse: 'Nurse@123', head_nurse: 'Nurse@123', receptionist: 'Reception@123', pharmacist: 'Pharma@123', lab_tech: 'LabTech@123', radiologist: 'Radio@123', billing: 'Billing@123', insurance: 'Insurance@123', compliance: 'Comply@123', inventory_manager: 'Inventory@123' };

async function seedUsers(io, models, ctx, report) {
    const { User, Department } = models;
    const deps = await io.load(Department);
    const existing = new Set((await io.load(User)).map((u) => u.username));
    let made = 0; const errs = [];
    for (let i = 0; i < EXTRA_USERS.length; i++) {
        const [username, role, first, last, dcode] = EXTRA_USERS[i];
        if (existing.has(username)) continue;
        const dep = deps.find((d) => d.departmentCode === dcode);
        try {
            const u = await io.create(User, {
                username, email: `${username}@hospital-his.com`, password: PW[role], role, department: dep && dep._id,
                profile: { firstName: first, lastName: last, phone: `+91-${phone()}`, employeeId: `EMP${3000 + i}`, dateOfJoining: daysAgo(int(100, 900)) }, isActive: true,
            });
            ctx.add('User', Object.assign({ role, department: dep && dep._id }, plain(u))); made++;
        } catch (e) { errs.push(`${username}: ${e.message.slice(0, 120)}`); }
    }
    report.User = { made, errs: errs.slice(0, 3) };
}

async function seedStaff(io, models, ctx, report) {
    const { Staff } = models;
    const users = ctx.pool('User');
    const have = new Set((await io.load(Staff)).map((s) => String(s.user)));
    let made = 0; const errs = [];
    for (const u of users) {
        if (have.has(String(u._id)) || u.role === 'admin') continue;
        try {
            const s = await io.create(Staff, {
                employeeId: `EMP-MK${pad(users.indexOf(u) + 1)}`, user: u._id, department: u.department,
                designation: ({ doctor: 'Consultant', nurse: 'Staff Nurse', head_nurse: 'Head Nurse', receptionist: 'Front Desk Executive', pharmacist: 'Pharmacist', lab_tech: 'Lab Technician', radiologist: 'Radiologist', billing: 'Billing Executive' })[u.role] || 'Executive',
                employmentType: pick(['permanent', 'permanent', 'contract']), joiningDate: daysAgo(int(200, 1500)),
                salary: { basic: int(30, 120) * 1000, allowances: int(3, 20) * 1000, deductions: int(1, 8) * 1000, net: int(30, 130) * 1000 },
                status: 'active', leaveBalance: { casual: int(4, 12), sick: int(4, 12), earned: int(0, 10) },
            });
            ctx.add('Staff', plain(s)); made++;
        } catch (e) { errs.push(e.message.slice(0, 120)); }
    }
    report.Staff = { made, errs: errs.slice(0, 3) };
}

// ---------------------------------------------------------------- orchestration
function orderModels(models) {
    const priority = ['Department', 'User', 'Staff', 'Ward', 'Bed', 'Location', 'InsuranceProvider', 'TariffCategory', 'Tariff', 'Medicine', 'LabTestMaster', 'RadiologyMaster', 'Patient', 'Appointment', 'EMR', 'Prescription', 'Admission'];
    const done = new Set(); const order = [];
    const visit = (n, stack) => {
        if (done.has(n) || stack.has(n) || !models[n]) return;
        stack.add(n);
        const refs = new Set();
        models[n].schema.eachPath((p, t) => {
            if (t.options && t.options.ref) refs.add(t.options.ref);
            if (t.caster && t.caster.options && t.caster.options.ref) refs.add(t.caster.options.ref);
            if (t.schema) t.schema.eachPath((q, u) => { if (u.options && u.options.ref) refs.add(u.options.ref); });
        });
        refs.forEach((r) => visit(r, stack));
        stack.delete(n); done.add(n); order.push(n);
    };
    priority.forEach((n) => visit(n, new Set()));
    Object.keys(models).sort().forEach((n) => visit(n, new Set()));
    return order;
}

function makeCtx(io) {
    const pools = {};
    return {
        pools,
        pool: (n) => pools[n] || (pools[n] = []),
        add: (n, d) => { (pools[n] = pools[n] || []).push(d); },
        matchString(re, fallback) {
            if (Array.isArray(re)) re = re[0];
            if (!(re instanceof RegExp)) return fallback;
            for (const c of [fallback, phone(), `${pick(FIRST_M)}@example.com`.toLowerCase(), '400001', 'ABC1234567', '12345678']) if (re.test(c)) return c;
            return fallback;
        },
    };
}

async function run(io, models, opts = {}) {
    const ctx = makeCtx(io);
    const report = {};
    const order = orderModels(models);
    // preload pools from the database
    for (const n of order) { try { ctx.pools[n] = await io.load(models[n]); } catch (e) { ctx.pools[n] = []; } }

    for (const pass of [1, 2]) for (const n of order) {
        if (SKIP.has(n)) continue;
        const M = models[n];
        if (pass === 2 && (!report[n] || report[n].skipped || n === 'User' || n === 'Staff')) continue;
        if (n === 'User') { await seedUsers(io, models, ctx, report); continue; }
        if (n === 'Staff') { await seedStaff(io, models, ctx, report); continue; }
        const target = TARGET[n] !== undefined ? TARGET[n] : DEFAULT_TARGET;
        const have = await io.count(M);
        const need = target - have;
        if (need <= 0) { if (pass === 1) report[n] = { skipped: `has ${have}` }; continue; }
        let made = 0; const errs = [];
        for (let i = 0; i < need; i++) {
            let ok = false;
            for (let attempt = 0; attempt < 6 && !ok; attempt++) {
                const d = genSchema(M.schema, M, ctx);
                if (FIX[n]) FIX[n](d, ctx, i);
                // unique string fields get a deterministic unique value
                M.schema.eachPath((p, t) => {
                    if (t.options && t.options.unique && t.instance === 'String' && !['patientId', 'appointmentNumber'].includes(p)) {
                        setPath(d, p, `${M.modelName.slice(0, 3).toUpperCase()}-MK${pad(have + i + 1, 5)}`);
                    }
                });
                if (M.schema.options.timestamps) d.createdAt = daysAgo(int(0, 60));
                try {
                    const created = await io.create(M, d);
                    ctx.add(n, Object.assign({}, d, plain(created)));
                    made++; ok = true;
                } catch (e) { if (attempt === 5) errs.push(e.message.slice(0, 200)); }
            }
            if (!ok && errs.length >= 3) break;
        }
        const prev = (report[n] && report[n].made) || 0;
        report[n] = { made: prev + made, errs: [...new Set(errs)].slice(0, 2) };
    }
    return report;
}

module.exports = { run, orderModels };

if (require.main === module) {
    require('dotenv').config();
    const mongoose = require('mongoose');
    const config = require('../config/config');
    const dir = path.join(__dirname, '..', 'models');
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) { try { require(path.join(dir, f)); } catch (e) { console.warn('skip model', f, e.message); } }
    const io = {
        count: (M) => M.countDocuments(),
        load: (M) => M.find({}).limit(500).lean(),
        create: (M, d) => M.create(d),
    };
    (async () => {
        await mongoose.connect(config.mongodbUri);
        console.log('MOCK SEED: connected, starting');
        const report = await run(io, mongoose.models);
        let made = 0, failed = [];
        for (const [n, r] of Object.entries(report)) { made += r.made || 0; if (r.errs && r.errs.length) failed.push(`${n}: ${r.errs[0]}`); }
        console.log('MOCK SEED SUMMARY');
        for (const [n, r] of Object.entries(report)) console.log(`  ${n.padEnd(26)} ${r.skipped ? 'skipped (' + r.skipped + ')' : 'created ' + r.made}`);
        console.log(`MOCK SEED TOTAL created ${made}`);
        failed.forEach((f) => console.log('MOCK SEED FAIL ' + f));
        await mongoose.connection.close();
        process.exit(0);
    })().catch((e) => { console.error('MOCK SEED ERROR', e); process.exit(1); });
}
