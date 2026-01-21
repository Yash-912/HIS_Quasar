const mongoose = require('mongoose');
const config = require('./config/config');
const Prescription = require('./models/Prescription');
const AppliedOrderSet = require('./models/AppliedOrderSet');
const OrderSet = require('./models/OrderSet');

async function checkDB() {
    try {
        await mongoose.connect(config.mongodbUri, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected to DB');

        const prescriptions = await Prescription.find({});
        console.log(`Total Prescriptions: ${prescriptions.length}`);
        if (prescriptions.length > 0) console.log(JSON.stringify(prescriptions[0], null, 2));

        const applied = await AppliedOrderSet.find({});
        console.log(`Total AppliedOrderSets: ${applied.length}`);
        if (applied.length > 0) {
            console.log('Last AppliedOrderSet Status:', applied[applied.length - 1].status);
            console.log('Last AppliedOrderSet Errors:', JSON.stringify(applied[applied.length - 1].errors, null, 2));
        }

        const orderSets = await OrderSet.find({});
        console.log(`Total OrderSets: ${orderSets.length}`);
        // Check if order sets have medications
        const withMeds = orderSets.filter(os => os.medications && os.medications.length > 0);
        console.log(`OrderSets with medications: ${withMeds.length}`);


    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.connection.close();
    }
}

checkDB();
