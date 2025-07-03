import mongoose from 'mongoose';
import { User } from '../model/userModel.js';
import { Referral } from '../model/referralModel.js';
import { createReferralRecord } from '../services/referralService.js';

/**
 * Script to create referral records for existing users who don't have them
 */
async function createMissingReferralRecords() {
  try {
    console.log('🔄 Creating missing referral records...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
    console.log('✅ Connected to database');

    // Find all verified users
    const users = await User.find({ 
      accountverified: true,
      isBlocked: false 
    }).select('_id name email');

    console.log(`📊 Found ${users.length} verified users`);

    let createdCount = 0;
    let existingCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // Check if referral record already exists
        const existingReferral = await Referral.findOne({ userId: user._id });
        
        if (existingReferral) {
          console.log(`⏭️  User ${user.name} (${user.email}) already has referral record`);
          existingCount++;
        } else {
          // Create referral record
          const referralRecord = await createReferralRecord(user._id, user.name);
          console.log(`✅ Created referral record for ${user.name} (${user.email})`);
          console.log(`   Code: ${referralRecord.referralCode}, Token: ${referralRecord.referralToken}`);
          createdCount++;
        }
      } catch (error) {
        console.error(`❌ Error creating referral record for ${user.name} (${user.email}):`, error.message);
        errorCount++;
      }
    }

    console.log('\n📈 Summary:');
    console.log(`✅ Created: ${createdCount} new referral records`);
    console.log(`⏭️  Existing: ${existingCount} users already had records`);
    console.log(`❌ Errors: ${errorCount} failed creations`);
    console.log(`📊 Total processed: ${users.length} users`);

    // Verify all users now have referral records
    const usersWithoutReferrals = await User.aggregate([
      {
        $match: {
          accountverified: true,
          isBlocked: false
        }
      },
      {
        $lookup: {
          from: 'referrals',
          localField: '_id',
          foreignField: 'userId',
          as: 'referralRecord'
        }
      },
      {
        $match: {
          referralRecord: { $size: 0 }
        }
      },
      {
        $project: {
          name: 1,
          email: 1
        }
      }
    ]);

    if (usersWithoutReferrals.length === 0) {
      console.log('\n🎉 All verified users now have referral records!');
    } else {
      console.log(`\n⚠️  ${usersWithoutReferrals.length} users still missing referral records:`);
      usersWithoutReferrals.forEach(user => {
        console.log(`   - ${user.name} (${user.email})`);
      });
    }

  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

/**
 * Verify referral records integrity
 */
async function verifyReferralRecords() {
  try {
    console.log('\n🔍 Verifying referral records integrity...\n');

    // Check for duplicate referral codes
    const duplicateCodes = await Referral.aggregate([
      {
        $group: {
          _id: '$referralCode',
          count: { $sum: 1 },
          users: { $push: { userId: '$userId', code: '$referralCode' } }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    if (duplicateCodes.length > 0) {
      console.log('⚠️  Found duplicate referral codes:');
      duplicateCodes.forEach(dup => {
        console.log(`   Code: ${dup._id} (${dup.count} users)`);
      });
    } else {
      console.log('✅ No duplicate referral codes found');
    }

    // Check for duplicate referral tokens
    const duplicateTokens = await Referral.aggregate([
      {
        $group: {
          _id: '$referralToken',
          count: { $sum: 1 },
          users: { $push: { userId: '$userId', token: '$referralToken' } }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    if (duplicateTokens.length > 0) {
      console.log('⚠️  Found duplicate referral tokens:');
      duplicateTokens.forEach(dup => {
        console.log(`   Token: ${dup._id} (${dup.count} users)`);
      });
    } else {
      console.log('✅ No duplicate referral tokens found');
    }

    // Check for invalid referral codes (too short, too long, etc.)
    const invalidCodes = await Referral.find({
      $or: [
        { referralCode: { $regex: /^.{0,5}$/ } }, // Too short
        { referralCode: { $regex: /^.{11,}$/ } }, // Too long
        { referralCode: { $regex: /[^A-Z0-9]/ } } // Invalid characters
      ]
    }).populate('userId', 'name email');

    if (invalidCodes.length > 0) {
      console.log('⚠️  Found invalid referral codes:');
      invalidCodes.forEach(record => {
        console.log(`   User: ${record.userId.name}, Code: ${record.referralCode}`);
      });
    } else {
      console.log('✅ All referral codes are valid');
    }

    console.log('\n🔍 Verification complete');

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Run the script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await createMissingReferralRecords();
  await verifyReferralRecords();
}