const mongoose = require('mongoose');
const config = require('./config/config');
const OrderSet = require('./models/OrderSet');
const Medicine = require('./models/Medicine');

async function check() {
    try {
        await mongoose.connect(config.mongodbUri, { useNewUrlParser: true, useUnifiedTopology: true });

        // Find the OrderSet with 5000 units
        const orderSet = await OrderSet.findOne({
            'medications.dosage': '5000 units'
        }).populate('medications.medicine');

        if (orderSet) {
            const medInfo = orderSet.medications.find(m => m.dosage === '5000 units');
            console.log('Medicine found:', medInfo.medicine.name);
            console.log('Generic:', medInfo.medicine.genericName);
        } else {
            console.log('Order set not found');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.connection.close();
    }
}

check();
