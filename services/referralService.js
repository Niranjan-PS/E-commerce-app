import { Referral } from '../model/referralModel.js';
import { User } from '../model/userModel.js';
import { Wallet } from '../model/walletModel.js';
import mongoose from 'mongoose';
import crypto from 'crypto';

// Referral reward amounts
const REFERRAL_REWARDS = {
  REFERRER_BONUS: 100,  // Amount referrer gets
  REFERRED_BONUS: 50    // Amount new user gets
};

/**
 * Create referral record for a new user
 */
export const createReferralRecord = async (userId, userName) => {
  try {
    console.log('Creating referral record for user:', userId, 'name:', userName);
    
    // Generate unique referral code and token
    let referralCode, referralToken;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      referralCode = Referral.generateReferralCode(userName, userId);
      referralToken = Referral.generateReferralToken();
      
      console.log(`Attempt ${attempts + 1}: Generated code: ${referralCode}, token: ${referralToken}`);
      
      // Check if code and token are unique
      const existingReferral = await Referral.findOne({
        $or: [
          { referralCode },
          { referralToken }
        ]
      });
      
      if (!existingReferral) {
        isUnique = true;
        console.log('Generated unique code and token');
      } else {
        console.log('Code or token already exists, trying again...');
      }
      attempts++;
    }

    if (!isUnique) {
      throw new Error('Failed to generate unique referral code after multiple attempts');
    }

    // Create referral record
    const referral = new Referral({
      userId,
      referralCode,
      referralToken
    });

    console.log('Saving referral record:', { userId, referralCode, referralToken });
    await referral.save();
    console.log('Referral record saved successfully');
    
    return referral;
  } catch (error) {
    console.error('Error creating referral record:', error);
    throw error;
  }
};

/**
 * Validate referral code or token
 */
export const validateReferral = async (identifier, newUserEmail, ipAddress) => {
  try {
    if (!identifier) {
      return { valid: false, message: 'No referral identifier provided' };
    }

    // Find referral by code or token
    const referral = await Referral.findByCodeOrToken(identifier);
    
    if (!referral) {
      return { valid: false, message: 'Invalid referral code or token' };
    }

    // Check if referrer user exists and is active
    if (!referral.userId || referral.userId.isBlocked) {
      return { valid: false, message: 'Referrer account is not active' };
    }

    // Check if the new user is trying to refer themselves
    if (referral.userId.email === newUserEmail) {
      return { valid: false, message: 'You cannot refer yourself' };
    }

    // Check for IP abuse (same IP used recently)
    if (ipAddress && referral.hasRecentIPUsage(ipAddress, 24)) {
      return { 
        valid: false, 
        message: 'This referral has been used recently from your location. Please try again later.' 
      };
    }

    // Check if user has already been referred by this referrer
    const existingReferral = referral.successfulReferrals.find(
      ref => ref.referredUserEmail === newUserEmail
    );
    
    if (existingReferral) {
      return { valid: false, message: 'You have already been referred by this user' };
    }

    return { 
      valid: true, 
      referral,
      referrer: referral.userId,
      message: 'Valid referral' 
    };
  } catch (error) {
    console.error('Error validating referral:', error);
    return { valid: false, message: 'Error validating referral' };
  }
};

/**
 * Process referral rewards after successful registration
 */
export const processReferralRewards = async (newUserId, referralData, ipAddress, userAgent) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const { referral, referrer } = referralData;
      
      // Get the new user
      const newUser = await User.findById(newUserId).session(session);
      if (!newUser) {
        throw new Error('New user not found');
      }

      // Update new user with referral information
      newUser.referredBy = referrer._id;
      newUser.referralMethod = referral.referralCode ? 'code' : 'token';
      newUser.referralRewardReceived = true;
      newUser.referralRewardAmount = REFERRAL_REWARDS.REFERRED_BONUS;
      newUser.wallet += REFERRAL_REWARDS.REFERRED_BONUS;
      await newUser.save({ session });

      // Update referrer's wallet
      const referrerUser = await User.findById(referrer._id).session(session);
      if (!referrerUser) {
        throw new Error('Referrer user not found');
      }
      
      referrerUser.wallet += REFERRAL_REWARDS.REFERRER_BONUS;
      await referrerUser.save({ session });

      // Update referrer's wallet transactions
      const referrerWallet = await Wallet.findOne({ userId: referrer._id }).session(session);
      if (referrerWallet) {
        referrerWallet.balance += REFERRAL_REWARDS.REFERRER_BONUS;
        referrerWallet.transactions.push({
          transactionId: `REF_${Date.now()}_${referrer._id}`,
          description: `Referral Bonus - ${newUser.name} joined using your referral`,
          amount: REFERRAL_REWARDS.REFERRER_BONUS,
          date: new Date()
        });
        await referrerWallet.save({ session });
      }

      // Update new user's wallet transactions
      const newUserWallet = await Wallet.findOne({ userId: newUserId }).session(session);
      if (newUserWallet) {
        newUserWallet.balance += REFERRAL_REWARDS.REFERRED_BONUS;
        newUserWallet.transactions.push({
          transactionId: `REF_${Date.now()}_${newUserId}`,
          description: `Welcome Bonus - Referred by ${referrer.name}`,
          amount: REFERRAL_REWARDS.REFERRED_BONUS,
          date: new Date()
        });
        await newUserWallet.save({ session });
      }

      // Add successful referral to referral record
      await referral.addSuccessfulReferral({
        referredUserId: newUserId,
        referredUserEmail: newUser.email,
        referredUserName: newUser.name,
        referralMethod: newUser.referralMethod,
        referrerReward: REFERRAL_REWARDS.REFERRER_BONUS,
        referredUserReward: REFERRAL_REWARDS.REFERRED_BONUS,
        ipAddress,
        userAgent
      });

      return {
        success: true,
        referrerReward: REFERRAL_REWARDS.REFERRER_BONUS,
        referredReward: REFERRAL_REWARDS.REFERRED_BONUS,
        referrerName: referrer.name
      };
    });

    return {
      success: true,
      referrerReward: REFERRAL_REWARDS.REFERRER_BONUS,
      referredReward: REFERRAL_REWARDS.REFERRED_BONUS
    };
  } catch (error) {
    console.error('Error processing referral rewards:', error);
    throw error;
  } finally {
    await session.endSession();
  }
};

/**
 * Get user's referral information
 */
export const getUserReferralInfo = async (userId) => {
  try {
    console.log('Getting referral info for user:', userId);
    const referral = await Referral.findOne({ userId }).populate('userId', 'name email');
    
    if (!referral) {
      console.log('No referral record found for user:', userId);
      return null;
    }

    console.log('Found referral record:', {
      code: referral.referralCode,
      token: referral.referralToken,
      totalReferrals: referral.totalReferrals,
      totalEarnings: referral.totalEarnings
    });

    const referralInfo = {
      referralCode: referral.referralCode,
      referralToken: referral.referralToken,
      referralUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/register?ref=${referral.referralToken}`,
      stats: referral.getStats(),
      recentReferrals: referral.successfulReferrals
        .sort((a, b) => b.referralDate - a.referralDate)
        .slice(0, 10)
        .map(ref => ({
          name: ref.referredUserName,
          email: ref.referredUserEmail,
          date: ref.referralDate,
          reward: ref.referrerReward,
          method: ref.referralMethod
        }))
    };

    console.log('Returning referral info:', referralInfo);
    return referralInfo;
  } catch (error) {
    console.error('Error getting user referral info:', error);
    throw error;
  }
};

/**
 * Generate referral link for sharing
 */
export const generateReferralLink = async (userId) => {
  try {
    const referral = await Referral.findOne({ userId });
    
    if (!referral) {
      throw new Error('Referral record not found');
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/register?ref=${referral.referralToken}`;
  } catch (error) {
    console.error('Error generating referral link:', error);
    throw error;
  }
};

/**
 * Get referral statistics for admin
 */
export const getReferralStatistics = async () => {
  try {
    const totalReferrals = await Referral.aggregate([
      { $group: { _id: null, total: { $sum: '$totalReferrals' } } }
    ]);

    const totalEarnings = await Referral.aggregate([
      { $group: { _id: null, total: { $sum: '$totalEarnings' } } }
    ]);

    const activeReferrers = await Referral.countDocuments({ 
      isActive: true, 
      totalReferrals: { $gt: 0 } 
    });

    const recentReferrals = await Referral.aggregate([
      { $unwind: '$successfulReferrals' },
      { $match: { 'successfulReferrals.referralDate': { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      { $count: 'count' }
    ]);

    return {
      totalReferrals: totalReferrals[0]?.total || 0,
      totalEarnings: totalEarnings[0]?.total || 0,
      activeReferrers,
      recentReferrals: recentReferrals[0]?.count || 0
    };
  } catch (error) {
    console.error('Error getting referral statistics:', error);
    throw error;
  }
};

export { REFERRAL_REWARDS };