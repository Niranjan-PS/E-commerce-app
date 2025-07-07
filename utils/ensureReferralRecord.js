import { Referral } from '../model/referralModel.js';
import { createReferralRecord } from '../services/referralService.js';

export const ensureReferralRecord = async (userId, userName) => {
  try {
   
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