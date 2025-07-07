import { Referral } from '../model/referralModel.js';
import { User } from '../model/userModel.js';
import { Wallet } from '../model/walletModel.js';
import mongoose from 'mongoose';
import crypto from 'crypto';


const REFERRAL_REWARDS = {
  REFERRER_BONUS: 100,  
  REFERRED_BONUS: 50    
};


export const createReferralRecord = async (userId, userName) => {
  try {
    console.log('Creating referral record for user:', userId, 'name:', userName);
    
  
    let referralCode, referralToken;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      referralCode = Referral.generateReferralCode(userName, userId);
      referralToken = Referral.generateReferralToken();
      
      console.log(`Attempt ${attempts + 1}: Generated code: ${referralCode}, token: ${referralToken}`);
      
     
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


export const validateReferral = async (identifier, newUserEmail, ipAddress) => {
  try {
    if (!identifier) {
      return { valid: false, message: 'No referral identifier provided' };
    }

  
    const referral = await Referral.findByCodeOrToken(identifier);
    
    if (!referral) {
      return { valid: false, message: 'Invalid referral code or token' };
    }

    
    if (!referral.userId || referral.userId.isBlocked) {
      return { valid: false, message: 'Referrer account is not active' };
    }

   
    if (referral.userId.email === newUserEmail) {
      return { valid: false, message: 'You cannot refer yourself' };
    }

   
    if (ipAddress && referral.hasRecentIPUsage(ipAddress, 24)) {
      return { 
        valid: false, 
        message: 'This referral has been used recently from your location. Please try again later.' 
      };
    }

   
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


export const processReferralRewards = async (newUserId, referralData, ipAddress, userAgent) => {
  const session = await mongoose.startSession();
  
  try {
   
    
    let transactionResult = null;
    
    await session.withTransaction(async () => {
      const { referral, referrer } = referralData;
      
      console.log(`[Referral] Processing referral: ${referral._id}, referrer: ${referrer._id}`);

     
      const newUser = await User.findById(newUserId).session(session);
      if (!newUser) {
        throw new Error('New user not found');
      }

     
      if (newUser.referralRewardReceived) {
        
        transactionResult = {
          success: false,
          message: 'Referral bonus already given to this user.'
        };
        return;
      }

     
      const referrerUser = await User.findById(referrer._id).session(session);
      if (!referrerUser) {
        throw new Error('Referrer user not found');
      }

      

     
      newUser.referredBy = referrer._id;
      newUser.referralMethod = referral.referralCode ? 'code' : 'token';
      newUser.referralRewardReceived = true;
      newUser.referralRewardAmount = REFERRAL_REWARDS.REFERRED_BONUS;
      newUser.showReferralToast = true;

     
      try {
        const { Coupon } = await import('../model/couponModel.js');
        const now = new Date();
        
        const coupon = await Coupon.findOne({
          isActive: true,
          validFrom: { $lte: now },
          validUntil: { $gte: now },
          $or: [
            { usageLimit: null },
            { $expr: { $lt: ['$usedCount', '$usageLimit'] } }
          ]
        }).sort({ validFrom: 1 }).session(session);
        
        if (coupon) {
          
          newUser.assignedCoupons = newUser.assignedCoupons || [];
          if (!newUser.assignedCoupons.includes(coupon._id)) {
            newUser.assignedCoupons.push(coupon._id);
           
          } else {
            console.log(`[Referral] Coupon already assigned to new user ${newUser.email}`);
          }
        } else {
          console.warn('[Referral] No active coupon found to assign to new user');
        }
      } catch (couponError) {
        console.error('[Referral] Could not assign coupon, but continuing with referral credit.', couponError);
      }

      // Save the user with coupon
      await newUser.save({ session });
      console.log(`[Referral] Updated new user referral info and assigned coupons`);

      
      const newUserWallet = await Wallet.findOne({ userId: newUserId }).session(session);
      if (newUserWallet) {
        newUserWallet.balance += REFERRAL_REWARDS.REFERRED_BONUS;
        newUserWallet.transactions.push({
          transactionId: `REF_${Date.now()}_${newUserId}`,
          description: 'Referral Bonus',
          amount: REFERRAL_REWARDS.REFERRED_BONUS,
          date: new Date()
        });
        await newUserWallet.save({ session });
        console.log(`[Referral] Credited ₹${REFERRAL_REWARDS.REFERRED_BONUS} to new user ${newUser.email}`);
      } else {
        console.error(`[Referral] Wallet not found for new user ${newUser.email}`);
        throw new Error('New user wallet not found');
      }

      // Credit referrer's wallet
      const referrerWallet = await Wallet.findOne({ userId: referrer._id }).session(session);
      if (referrerWallet) {
        referrerWallet.balance += REFERRAL_REWARDS.REFERRER_BONUS;
        referrerWallet.transactions.push({
          transactionId: `REF_${Date.now()}_${referrer._id}`,
          description: 'Referral Reward',
          amount: REFERRAL_REWARDS.REFERRER_BONUS,
          date: new Date()
        });
        await referrerWallet.save({ session });
        console.log(`[Referral] Credited ₹${REFERRAL_REWARDS.REFERRER_BONUS} to referrer ${referrerUser.email}`);
      } else {
        console.error(`[Referral] Wallet not found for referrer ${referrerUser.email}`);
        throw new Error('Referrer wallet not found');
      }

     
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

      console.log(`[Referral] Referral rewards processed successfully for new user ${newUser.email} and referrer ${referrerUser.email}`);
      
      transactionResult = {
        success: true,
        referrerReward: REFERRAL_REWARDS.REFERRER_BONUS,
        referredReward: REFERRAL_REWARDS.REFERRED_BONUS,
        referrerName: referrerUser.name
      };
    });

    console.log(`[Referral] Transaction completed, result:`, transactionResult);
    
    return transactionResult || {
      success: true,
      referrerReward: REFERRAL_REWARDS.REFERRER_BONUS,
      referredReward: REFERRAL_REWARDS.REFERRED_BONUS
    };
    
  } catch (error) {
    console.error('[Referral] Error processing referral rewards:', error);
    console.error('[Referral] Error stack:', error.stack);
    throw error;
  } finally {
    await session.endSession();
  }
};


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
      referralUrl: `${process.env.BASE_URL || 'http://localhost:4003'}/register?ref=${referral.referralToken}`,
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


export const generateReferralLink = async (userId) => {
  try {
    const referral = await Referral.findOne({ userId });
    
    if (!referral) {
      throw new Error('Referral record not found');
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:4003';
    return `${baseUrl}/register?ref=${referral.referralToken}`;
  } catch (error) {
    console.error('Error generating referral link:', error);
    throw error;
  }
};


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


export const getUserAvailableCoupons = async (userId) => {
  try {
    const { Coupon } = await import('../model/couponModel.js');
    const user = await User.findById(userId).populate('assignedCoupons');
    
    if (!user) {
      return [];
    }

    const now = new Date();
    const availableCoupons = [];

    
    if (user.assignedCoupons && user.assignedCoupons.length > 0) {
      for (const coupon of user.assignedCoupons) {
        if (coupon && coupon.isValid()) {
          
          const hasUsed = coupon.usedBy.some(usage => 
            usage.user.toString() === userId.toString()
          );
          
          if (!hasUsed) {
            availableCoupons.push({
              _id: coupon._id,
              code: coupon.code,
              description: coupon.description,
              discountType: coupon.discountType,
              discountValue: coupon.discountValue,
              minimumAmount: coupon.minimumAmount,
              maximumDiscount: coupon.maximumDiscount,
              validUntil: coupon.validUntil,
              source: 'referral'
            });
          }
        }
      }
    }

    return availableCoupons;
  } catch (error) {
    console.error('Error getting user available coupons:', error);
    return [];
  }
};

export { REFERRAL_REWARDS };