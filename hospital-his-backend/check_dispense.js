const mongoose = require('mongoose');
const config = require('./config/config');
const Prescription = require('./models/Prescription');

async function checkDispenseStatus() {
    try {
        await mongoose.connect(config.mongodbUri, { useNewUrlParser: true, useUnifiedTopology: true });

        // Find the most recent prescription
        const rx = await Prescription.findOne().sort({ createdAt: -1 });

        if (rx) {
            console.log('Prescription ID:', rx._id);
            console.log('Is Dispensed:', rx.isDispensed);
            console.log('Dispensed By:', rx.dispensedBy);
            console.log('Dispensed At:', rx.dispensedAt);
        } else {
            console.log('No prescriptions found');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.connection.close();
    }
}

checkDispenseStatus();
