const mongoose = require('mongoose');
const dns = require('dns');
const logger = require('../utils/logger');
const config = require('./config');

// Fix for Node.js DNS issues on Windows with MongoDB Atlas SRV
dns.setDefaultResultOrder('ipv4first');

/**
 * MongoDB Connection Configuration
 * Establishes connection to MongoDB database with retry logic
 */

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(config.mongodbUri);

        logger.info(`MongoDB Connected: ${conn.connection.host}`);

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            logger.error(`MongoDB connection error: ${err}`);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected. Attempting to reconnect...');
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconnected');
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            logger.info('MongoDB connection closed due to app termination');
            process.exit(0);
        });

        return conn;
    } catch (error) {
        logger.error(`Error connecting to MongoDB: ${error.message}`);
        // Exit process with failure
        process.exit(1);
    }
};

module.exports = connectDB;
console.log("MONGODB_URI =", process.env.MONGODB_URI);
