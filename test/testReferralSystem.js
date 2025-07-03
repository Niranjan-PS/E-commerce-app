import mongoose from 'mongoose';
import { User } from '../model/userModel.js';
import { Referral } from '../model/referralModel.js';
import { Wallet } from '../model/walletModel.js';
import { 
  createReferralRecord, 
  validateReferral, 
  processReferralRewards,
  getUserReferralInfo,
  getReferralStatistics
} from '../services/referralService.js';

/**
 * Test script to verify the referral system functionality
 */
async function testReferralSystem() {
  try {
    console.log('🧪 Testing Referral System...\n');

    // Test 1: Create referral record for existing user
    console.log('Test 1: Creating referral record');
    const users = await User.find({ accountverified: true }).limit(2);
    
    if (users.length < 2) {
      console.log('❌ Need at least 2 verified users to test referral system');
      return;
    }

    const referrer = users[0];
    const newUser = users[1];

    // Create referral record for referrer if doesn't exist
    let referralRecord = await Referral.findOne({ userId: referrer._id });
    if (!referralRecord) {
      referralRecord = await createReferralRecord(referrer._id, referrer.name);
      console.log(`✅ Created referral record for ${referrer.name}`);
      console.log(`   Referral Code: ${referralRecord.referralCode}`);
      console.log(`   Referral Token: ${referralRecord.referralToken}`);
    } else {
      console.log(`✅ Referral record already exists for ${referrer.name}`);
      console.log(`   Referral Code: ${referralRecord.referralCode}`);
    }
    console.log();

    // Test 2: Validate referral code
    console.log('Test 2: Validating referral code');
    const validation = await validateReferral(
      referralRecord.referralCode, 
      'test@example.com', 
      '192.168.1.1'
    );
    
    console.log(`Validation result: ${validation.valid ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`Message: ${validation.message}`);
    if (validation.valid) {
      console.log(`Referrer: ${validation.referrer.name} (${validation.referrer.email})`);
    }
    console.log();

    // Test 3: Validate referral token
    console.log('Test 3: Validating referral token');
    const tokenValidation = await validateReferral(
      referralRecord.referralToken, 
      'test2@example.com', 
      '192.168.1.2'
    );
    
    console.log(`Token validation: ${tokenValidation.valid ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`Message: ${tokenValidation.message}`);
    console.log();

    // Test 4: Test invalid referral
    console.log('Test 4: Testing invalid referral code');
    const invalidValidation = await validateReferral(
      'INVALID123', 
      'test3@example.com', 
      '192.168.1.3'
    );
    
    console.log(`Invalid code result: ${invalidValidation.valid ? '❌ Should be invalid' : '✅ Correctly invalid'}`);
    console.log(`Message: ${invalidValidation.message}`);
    console.log();

    // Test 5: Test self-referral prevention
    console.log('Test 5: Testing self-referral prevention');
    const selfReferralValidation = await validateReferral(
      referralRecord.referralCode, 
      referrer.email, 
      '192.168.1.4'
    );
    
    console.log(`Self-referral result: ${selfReferralValidation.valid ? '❌ Should be invalid' : '✅ Correctly prevented'}`);
    console.log(`Message: ${selfReferralValidation.message}`);
    console.log();

    // Test 6: Get user referral info
    console.log('Test 6: Getting user referral info');
    const referralInfo = await getUserReferralInfo(referrer._id);
    
    if (referralInfo) {
      console.log('✅ Referral info retrieved successfully');
      console.log(`   Referral Code: ${referralInfo.referralCode}`);
      console.log(`   Total Referrals: ${referralInfo.stats.totalReferrals}`);
      console.log(`   Total Earnings: ₹${referralInfo.stats.totalEarnings}`);
      console.log(`   Referral URL: ${referralInfo.referralUrl}`);
    } else {
      console.log('❌ Failed to get referral info');
    }
    console.log();

    // Test 7: Get referral statistics
    console.log('Test 7: Getting referral statistics');
    const stats = await getReferralStatistics();
    
    console.log('✅ Referral statistics:');
    console.log(`   Total Referrals: ${stats.totalReferrals}`);
    console.log(`   Total Earnings: ₹${stats.totalEarnings}`);
    console.log(`   Active Referrers: ${stats.activeReferrers}`);
    console.log(`   Recent Referrals: ${stats.recentReferrals}`);
    console.log();

    // Test 8: Test referral code generation uniqueness
    console.log('Test 8: Testing referral code uniqueness');
    const testCodes = new Set();
    const testUsers = ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Brown', 'Charlie Wilson'];
    
    for (let i = 0; i < testUsers.length; i++) {
      const testUserId = new mongoose.Types.ObjectId();
      const code = Referral.generateReferralCode(testUsers[i], testUserId);
      testCodes.add(code);
      console.log(`   ${testUsers[i]} -> ${code}`);
    }
    
    console.log(`✅ Generated ${testCodes.size} unique codes out of ${testUsers.length} attempts`);
    console.log();

    // Test 9: Test referral token generation
    console.log('Test 9: Testing referral token generation');
    const testTokens = new Set();
    
    for (let i = 0; i < 5; i++) {
      const token = Referral.generateReferralToken();
      testTokens.add(token);
      console.log(`   Token ${i + 1}: ${token}`);
    }
    
    console.log(`✅ Generated ${testTokens.size} unique tokens out of 5 attempts`);
    console.log();

    // Test 10: Test IP abuse prevention
    console.log('Test 10: Testing IP abuse prevention');
    const sameIPValidation1 = await validateReferral(
      referralRecord.referralCode, 
      'user1@example.com', 
      '192.168.1.100'
    );
    
    const sameIPValidation2 = await validateReferral(
      referralRecord.referralCode, 
      'user2@example.com', 
      '192.168.1.100'
    );
    
    console.log(`First validation from IP: ${sameIPValidation1.valid ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`Second validation from same IP: ${sameIPValidation2.valid ? '❌ Should be blocked' : '✅ Correctly blocked'}`);
    console.log();

    console.log('✅ Referral system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Test the complete referral flow
 */
async function testCompleteReferralFlow() {
  try {
    console.log('\n🔄 Testing Complete Referral Flow...\n');

    // Find or create test users
    let referrer = await User.findOne({ email: 'referrer@test.com' });
    if (!referrer) {
      referrer = await User.create({
        name: 'Test Referrer',
        email: 'referrer@test.com',
        phone: '+919876543210',
        password: 'TestPassword123',
        accountverified: true
      });
      
      await Wallet.create({ 
        userId: referrer._id, 
        balance: 0, 
        transactions: [] 
      });
      
      console.log('✅ Created test referrer user');
    }

    // Create referral record
    let referralRecord = await Referral.findOne({ userId: referrer._id });
    if (!referralRecord) {
      referralRecord = await createReferralRecord(referrer._id, referrer.name);
      console.log('✅ Created referral record');
    }

    // Simulate new user registration with referral
    const newUserData = {
      name: 'Test Referred User',
      email: 'referred@test.com',
      phone: '+919876543211',
      password: 'TestPassword123',
      accountverified: true
    };

    // Check if user already exists
    let newUser = await User.findOne({ email: newUserData.email });
    if (newUser) {
      await User.deleteOne({ _id: newUser._id });
      await Wallet.deleteOne({ userId: newUser._id });
    }

    // Create new user
    newUser = await User.create(newUserData);
    await Wallet.create({ 
      userId: newUser._id, 
      balance: 0, 
      transactions: [] 
    });

    console.log('✅ Created new user for referral test');

    // Validate referral
    const validation = await validateReferral(
      referralRecord.referralCode,
      newUser.email,
      '192.168.1.200'
    );

    if (validation.valid) {
      console.log('✅ Referral validation successful');
      
      // Process referral rewards
      const rewardResult = await processReferralRewards(
        newUser._id,
        validation,
        '192.168.1.200',
        'Test User Agent'
      );

      if (rewardResult.success) {
        console.log('✅ Referral rewards processed successfully');
        console.log(`   Referrer reward: ₹${rewardResult.referrerReward}`);
        console.log(`   Referred user reward: ₹${rewardResult.referredReward}`);

        // Verify wallet balances
        const updatedReferrer = await User.findById(referrer._id);
        const updatedNewUser = await User.findById(newUser._id);

        console.log(`   Referrer wallet balance: ₹${updatedReferrer.wallet}`);
        console.log(`   New user wallet balance: ₹${updatedNewUser.wallet}`);

        // Verify referral record update
        const updatedReferralRecord = await Referral.findById(referralRecord._id);
        console.log(`   Total referrals: ${updatedReferralRecord.totalReferrals}`);
        console.log(`   Total earnings: ₹${updatedReferralRecord.totalEarnings}`);
      } else {
        console.log('❌ Failed to process referral rewards');
      }
    } else {
      console.log('❌ Referral validation failed:', validation.message);
    }

    // Clean up test data
    await User.deleteOne({ _id: newUser._id });
    await Wallet.deleteOne({ userId: newUser._id });
    console.log('✅ Cleaned up test data');

    console.log('\n✅ Complete referral flow test completed!');
    
  } catch (error) {
    console.error('❌ Complete flow test failed:', error);
  }
}

/**
 * Run tests if this file is executed directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  // Connect to database
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
  
  // Run tests
  await testReferralSystem();
  await testCompleteReferralFlow();
  
  // Close connection
  await mongoose.connection.close();
  console.log('Database connection closed.');
}