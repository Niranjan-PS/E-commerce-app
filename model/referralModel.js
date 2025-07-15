import mongoose from 'mongoose';
import crypto from 'crypto';

const referralSchema = new mongoose.Schema({
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  
  referralCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minLength: 6,
    maxLength: 10
  },
  
  
  referralToken: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
 
  totalReferrals: {
    type: Number,
    default: 0
  },
  
  totalEarnings: {
    type: Number,
    default: 0
  },
  
  // Track successful referrals
  successfulReferrals: [{
    referredUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    referredUserEmail: {
      type: String,
      required: true
    },
    referredUserName: {
      type: String,
      required: true
    },
    referralMethod: {
      type: String,
      enum: ['code', 'token'],
      required: true
    },
    referrerReward: {
      type: Number,
      required: true
    },
    referredUserReward: {
      type: Number,
      required: true
    },
    referralDate: {
      type: Date,
      default: Date.now
    },
    ipAddress: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: null
    }
  }],
  
  // Abuse prevention
  lastUsedIPs: [{
    ip: String,
    usedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
 
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
});


referralSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});


referralSchema.statics.generateReferralCode = function(userName, userId) {
  try {
    
    const cleanName = userName ? userName.replace(/[^A-Za-z]/g, '') : 'USR';
    const namePrefix = cleanName.length >= 3 ? cleanName.substring(0, 3).toUpperCase() : 
                      cleanName.toUpperCase().padEnd(3, 'X');
    
    
    const userIdStr = userId.toString();
    const idSuffix = userIdStr.length >= 3 ? userIdStr.slice(-3) : userIdStr.padStart(3, '0');
    
   
    const randomNum = Math.floor(Math.random() * 999).toString().padStart(3, '0');
    
    const referralCode = `${namePrefix}${idSuffix}${randomNum}`;
    
    
    return referralCode.toUpperCase().substring(0, 9);
  } catch (error) {
    console.error('Error generating referral code:', error);
   
    const timestamp = Date.now().toString().slice(-6);
    return `REF${timestamp}`;
  }
};


referralSchema.statics.generateReferralToken = function() {
  return crypto.randomBytes(16).toString('hex');
};


referralSchema.statics.findByCodeOrToken = function(identifier) {
  return this.findOne({
    $or: [
      { referralCode: identifier.toUpperCase() },
      { referralToken: identifier }
    ],
    isActive: true
  }).populate('userId', 'name email');
};

// Check if IP has been used recently
referralSchema.methods.hasRecentIPUsage = function(ipAddress, hoursLimit = 24) {
  const cutoffTime = new Date(Date.now() - (hoursLimit * 60 * 60 * 1000));
  return this.lastUsedIPs.some(ipRecord => 
    ipRecord.ip === ipAddress && ipRecord.usedAt > cutoffTime
  );
};


referralSchema.methods.addSuccessfulReferral = function(referralData) {
  this.successfulReferrals.push(referralData);
  this.totalReferrals += 1;
  this.totalEarnings += referralData.referrerReward;
  
  
  if (referralData.ipAddress) {
    this.lastUsedIPs.push({
      ip: referralData.ipAddress,
      usedAt: new Date()
    });
    
    
    if (this.lastUsedIPs.length > 50) {
      this.lastUsedIPs = this.lastUsedIPs.slice(-50);
    }
  }
  
  return this.save();
};


referralSchema.methods.getStats = function() {
  return {
    totalReferrals: this.totalReferrals,
    totalEarnings: this.totalEarnings,
    successfulReferrals: this.successfulReferrals.length,
    recentReferrals: this.successfulReferrals
      .filter(ref => ref.referralDate > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .length,
    referralCode: this.referralCode,
    referralToken: this.referralToken
  };
};

export const Referral = mongoose.model('Referral', referralSchema);