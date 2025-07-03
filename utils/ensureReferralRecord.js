import { Referral } from '../model/referralModel.js';
import { createReferralRecord } from '../services/referralService.js';

/**
 * Ensure a user has a referral record, create one if it doesn't exist
 * @param {String} userId - User ID
 * @param {String} userName - User name
 * @returns {Object} - Referral record
 */
export const ensureReferralRecord = async (userId, userName) => {
  try {
    // Check if referral record already exists
    let referralRecord = await Referral.findOne({ userId });
    
    if (!referralRecord) {
      console.log(`Creating referral record for user: ${userId}`);
      referralRecord = await createReferralRecord(userId, userName);
    }
    
    return referralRecord;
  } catch (error) {
    console.error('Error ensuring referral record:', error);
    throw error;
  }
};