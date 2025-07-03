import mongoose from 'mongoose';
import { User } from '../model/userModel.js';
import { Referral } from '../model/referralModel.js';
import { createReferralRecord } from '../services/referralService.js';

/**
 * Simple test to create a referral record for a user
 */
async function testReferralCreation() {
  try {
    console.log('🧪 Testing referral record creation...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
    console.log('✅ Connected to database');

    // Find a test user
    const user = await User.findOne({ 
      accountverified: true,
      isBlocked: false 
    });

    if (!user) {
      console.log('❌ No verified users found');
      return;
    }

    console.log(`📝 Testing with user: ${user.name} (${user.email})`);

    // Check if referral record already exists
    let existingReferral = await Referral.findOne({ userId: user._id });
    
    if (existingReferral) {
      console.log('📋 Existing referral record found:');
      console.log(`   Code: ${existingReferral.referralCode}`);
      console.log(`   Token: ${existingReferral.referralToken}`);
      console.log(`   Total Referrals: ${existingReferral.totalReferrals}`);
      console.log(`   Total Earnings: ₹${existingReferral.totalEarnings}`);
    } else {
      console.log('🆕 No existing referral record, creating new one...');
      
      try {
        const newReferral = await createReferralRecord(user._id, user.name);
        console.log('✅ Successfully created referral record:');
        console.log(`   Code: ${newReferral.referralCode}`);
        console.log(`   Token: ${newReferral.referralToken}`);
        console.log(`   User ID: ${newReferral.userId}`);
      } catch (error) {
        console.error('❌ Failed to create referral record:', error);
      }
    }

    // Test the referral code generation function
    console.log('\n🔧 Testing referral code generation:');
    for (let i = 0; i < 5; i++) {
      const testCode = Referral.generateReferralCode(user.name, user._id);
      const testToken = Referral.generateReferralToken();
      console.log(`   ${i + 1}. Code: ${testCode}, Token: ${testToken}`);
    }

    // Test finding the referral record
    console.log('\n🔍 Testing referral record retrieval:');
    const foundReferral = await Referral.findOne({ userId: user._id });
    
    if (foundReferral) {
      console.log('✅ Referral record found in database:');
      console.log(`   Code: ${foundReferral.referralCode}`);
      console.log(`   Token: ${foundReferral.referralToken}`);
      console.log(`   Active: ${foundReferral.isActive}`);
      console.log(`   Created: ${foundReferral.createdAt}`);
    } else {
      console.log('❌ Referral record not found in database');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await testReferralCreation();
}