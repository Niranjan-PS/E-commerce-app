import mongoose from 'mongoose';
import crypto from 'crypto';

const referralSchema = new mongoose.Schema({
  // User who owns this referral code
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Static referral code (e.g., "NIR123")
  referralCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minLength: 6,
    maxLength: 10
  },
  
  // Token-based referral token for URL sharing
  referralToken: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  // Statistics
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
  
  // Metadata
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

// Update the updatedAt field before saving
referralSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Generate a unique referral code based on user's name and ID
referralSchema.statics.generateReferralCode = function(userName, userId) {
  try {
    // Clean the username and take first 3 characters
    const cleanName = userName ? userName.replace(/[^A-Za-z]/g, '') : 'USR';
    const namePrefix = cleanName.length >= 3 ? cleanName.substring(0, 3).toUpperCase() : 
                      cleanName.toUpperCase().padEnd(3, 'X');
    
    // Get last 3 characters of user ID
    const userIdStr = userId.toString();
    const idSuffix = userIdStr.length >= 3 ? userIdStr.slice(-3) : userIdStr.padStart(3, '0');
    
    // Add a random number to ensure uniqueness
    const randomNum = Math.floor(Math.random() * 999).toString().padStart(3, '0');
    
    const referralCode = `${namePrefix}${idSuffix}${randomNum}`;
    
    // Ensure the code is exactly 9 characters and uppercase
    return referralCode.toUpperCase().substring(0, 9);
  } catch (error) {
    console.error('Error generating referral code:', error);
    // Fallback code generation
    const timestamp = Date.now().toString().slice(-6);
    return `REF${timestamp}`;
  }
};

// Generate a secure referral token
referralSchema.statics.generateReferralToken = function() {
  return crypto.randomBytes(16).toString('hex');
};

// Find referral by code or token
referralSchema.statics.findByCodeOrToken = function(identifier) {
  return this.findOne({
    $or: [
      { referralCode: identifier.toUpperCase() },
      { referralToken: identifier }
    ],
    isActive: true
  }).populate('userId', 'name email');
};

// Check if IP has been used recently (abuse prevention)
referralSchema.methods.hasRecentIPUsage = function(ipAddress, hoursLimit = 24) {
  const cutoffTime = new Date(Date.now() - (hoursLimit * 60 * 60 * 1000));
  return this.lastUsedIPs.some(ipRecord => 
    ipRecord.ip === ipAddress && ipRecord.usedAt > cutoffTime
  );
};

// Add successful referral
referralSchema.methods.addSuccessfulReferral = function(referralData) {
  this.successfulReferrals.push(referralData);
  this.totalReferrals += 1;
  this.totalEarnings += referralData.referrerReward;
  
  // Add IP to tracking (keep only last 50 IPs)
  if (referralData.ipAddress) {
    this.lastUsedIPs.push({
      ip: referralData.ipAddress,
      usedAt: new Date()
    });
    
    // Keep only the last 50 IP records
    if (this.lastUsedIPs.length > 50) {
      this.lastUsedIPs = this.lastUsedIPs.slice(-50);
    }
  }
  
  return this.save();
};

// Get referral statistics
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