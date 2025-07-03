import { catchAsyncError } from '../../middlewares/catchAsync.js';
import { getUserReferralInfo, generateReferralLink } from '../../services/referralService.js';
import { User } from '../../model/userModel.js';
import { Referral } from '../../model/referralModel.js';
import { ensureReferralRecord } from '../../utils/ensureReferralRecord.js';
import HttpStatus from '../../helpers/httpStatus.js';

/**
 * Get user's referral dashboard
 */
export const getReferralDashboard = catchAsyncError(async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userName = req.user.name;
    
    // Ensure referral record exists
    await ensureReferralRecord(userId, userName);
    
    const referralInfo = await getUserReferralInfo(userId);
    
    if (!referralInfo) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Referral information not found'
      });
    }

    res.status(HttpStatus.OK).json({
      success: true,
      data: referralInfo
    });
  } catch (error) {
    console.error('Error getting referral dashboard:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to load referral information'
    });
  }
});

/**
 * Generate referral link for sharing
 */
export const generateShareableLink = catchAsyncError(async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userName = req.user.name;
    
    // Ensure referral record exists
    await ensureReferralRecord(userId, userName);
    
    const referralLink = await generateReferralLink(userId);
    
    res.status(HttpStatus.OK).json({
      success: true,
      data: {
        referralLink,
        message: 'Share this link with friends to earn rewards!'
      }
    });
  } catch (error) {
    console.error('Error generating referral link:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to generate referral link'
    });
  }
});

/**
 * Get referral statistics for the user
 */
export const getReferralStats = catchAsyncError(async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userName = req.user.name;
    
    // Ensure referral record exists
    await ensureReferralRecord(userId, userName);
    
    const referral = await Referral.findOne({ userId }).populate('userId', 'name email');
    
    if (!referral) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Referral record not found'
      });
    }

    const stats = referral.getStats();
    
    res.status(HttpStatus.OK).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting referral stats:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to load referral statistics'
    });
  }
});

/**
 * Validate referral code (for frontend validation)
 */
export const validateReferralCode = catchAsyncError(async (req, res, next) => {
  try {
    const { code } = req.body;
    
    if (!code || !code.trim()) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Referral code is required'
      });
    }

    const referral = await Referral.findByCodeOrToken(code.trim());
    
    if (!referral) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Invalid referral code'
      });
    }

    // Check if referrer is active
    if (!referral.userId || referral.userId.isBlocked) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Referrer account is not active'
      });
    }

    res.status(HttpStatus.OK).json({
      success: true,
      data: {
        valid: true,
        referrerName: referral.userId.name,
        bonus: 50,
        message: `Valid referral code from ${referral.userId.name}. You'll get ₹50 bonus!`
      }
    });
  } catch (error) {
    console.error('Error validating referral code:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to validate referral code'
    });
  }
});

/**
 * Render referral dashboard page
 */
export const renderReferralDashboard = catchAsyncError(async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userName = req.user.name;
    
    // Ensure referral record exists
    await ensureReferralRecord(userId, userName);
    
    const referralInfo = await getUserReferralInfo(userId);
    const user = await User.findById(userId);
    
    res.render('user/referral-dashboard', {
      title: 'Referral Dashboard',
      user,
      referralInfo,
      baseUrl: process.env.BASE_URL || 'http://localhost:3000'
    });
  } catch (error) {
    console.error('Error rendering referral dashboard:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('error', {
      message: 'Failed to load referral dashboard'
    });
  }
});