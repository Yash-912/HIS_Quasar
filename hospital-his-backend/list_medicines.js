const mongoose = require('mongoose');
const config = require('./config/config');
const Medicine = require('./models/Medicine');

async function listMedicines() {
    try {
        await mongoose.connect(config.mongodbUri, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected to DB');

        const medicines = await Medicine.find({ isActive: true }).limit(15);
        medicines.forEach((med, idx) => {
            console.log(`${idx}: ${med.name} (${med.genericName}) - ${med.strength}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.connection.close();
    }
}

listMedicines();
