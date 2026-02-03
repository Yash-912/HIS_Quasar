/**
 * Seed script to create Voice Agent service account
 * Run: node scripts/seedVoiceAgent.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hospital_his';

// Voice Agent credentials
const VOICE_AGENT_CONFIG = {
    username: 'voice_agent',
    email: 'voice_agent@hospital.local',
    password: 'VoiceAgent@2024',
    role: 'receptionist',
    profile: {
        firstName: 'Voice',
        lastName: 'Agent',
        phone: '0000000000'
    }
};

async function seedVoiceAgent() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Get User model
        const User = mongoose.model('User', new mongoose.Schema({
            username: String,
            email: String,
            password: String,
            role: String,
            profile: {
                firstName: String,
                lastName: String,
                phone: String
            },
            isActive: Boolean,
            createdAt: Date,
            updatedAt: Date
        }));

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [
                { username: VOICE_AGENT_CONFIG.username },
                { email: VOICE_AGENT_CONFIG.email }
            ]
        });

        if (existingUser) {
            console.log('Voice Agent user already exists!');
            console.log(`  Username: ${existingUser.username}`);
            console.log(`  Role: ${existingUser.role}`);
            console.log(`  ID: ${existingUser._id}`);

            // Update password if needed
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(VOICE_AGENT_CONFIG.password, salt);
            await User.updateOne(
                { _id: existingUser._id },
                {
                    $set: {
                        password: hashedPassword,
                        isActive: true,
                        updatedAt: new Date()
                    }
                }
            );
            console.log('Password reset to default.');
        } else {
            // Create new user
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(VOICE_AGENT_CONFIG.password, salt);

            const voiceAgent = new User({
                username: VOICE_AGENT_CONFIG.username,
                email: VOICE_AGENT_CONFIG.email,
                password: hashedPassword,
                role: VOICE_AGENT_CONFIG.role,
                profile: VOICE_AGENT_CONFIG.profile,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await voiceAgent.save();
            console.log('Voice Agent user created successfully!');
            console.log(`  Username: ${VOICE_AGENT_CONFIG.username}`);
            console.log(`  Password: ${VOICE_AGENT_CONFIG.password}`);
            console.log(`  Role: ${VOICE_AGENT_CONFIG.role}`);
            console.log(`  ID: ${voiceAgent._id}`);
        }

        console.log('\n✅ Voice Agent service account is ready!');
        console.log('\nUpdate voice-agent/.env with:');
        console.log(`  HIS_API_USERNAME=voice_agent`);
        console.log(`  HIS_API_PASSWORD=VoiceAgent@2024`);

    } catch (error) {
        console.error('Error seeding voice agent:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

// Run the seed
seedVoiceAgent();
