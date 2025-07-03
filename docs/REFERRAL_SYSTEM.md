 # Referral System Implementation

## Overview

This document describes the implementation of a comprehensive referral system that supports both token-based referral links and static referral codes with wallet rewards.

## Features Implemented

✅ **Dual Referral Methods**
- Static referral codes (e.g., "NIR123") 
- Token-based referral links (e.g., "https://app.com/register?ref=abc123token")

✅ **Wallet Integration**
- New users get ₹50 bonus
- Referrers get ₹100 bonus
- Automatic wallet credit with transaction logging

✅ **Security & Abuse Prevention**
- IP-based abuse detection
- Self-referral prevention
- Duplicate registration prevention
- Secure token generation

✅ **Comprehensive Dashboard**
- Referral statistics and earnings
- Shareable links and codes
- Recent referrals tracking
- Social media sharing integration

## System Architecture

### Core Components

1. **Referral Model** (`model/referralModel.js`)
   - Stores referral codes, tokens, and statistics
   - Tracks successful referrals and earnings
   - Implements abuse prevention mechanisms

2. **Referral Service** (`services/referralService.js`)
   - Business logic for referral operations
   - Validation and reward processing
   - Statistics and reporting

3. **Enhanced User Model** (`model/userModel.js`)
   - Referral-related fields added
   - Tracks referral relationships
   - Stores reward information

4. **Referral Controller** (`controllers/user/referralController.js`)
   - API endpoints for referral operations
   - Dashboard rendering and data management

## Data Flow

```
Registration with Referral Code/Token
           ↓
    Validate Referral
           ↓
    Create User Account
           ↓
    Process OTP Verification
           ↓
    Process Referral Rewards
           ↓
    Update Wallets & Create Transactions
           ↓
    Create Referral Record for New User
```

## Implementation Details

### Referral Code Generation

```javascript
// Static referral code format: [NAME_PREFIX][USER_ID_SUFFIX][RANDOM]
// Example: "NIR123456" (NIR + 123 + 456)
const generateReferralCode = (userName, userId) => {
  const namePrefix = userName.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
  const idSuffix = userId.toString().slice(-3);
  const randomNum = Math.floor(Math.random() * 999).toString().padStart(3, '0');
  return `${namePrefix}${idSuffix}${randomNum}`;
};
```

### Token Generation

```javascript
// Secure token generation using crypto
const generateReferralToken = () => {
  return crypto.randomBytes(16).toString('hex');
};
```

### Reward Processing

```javascript
const REFERRAL_REWARDS = {
  REFERRER_BONUS: 100,  // Amount referrer gets
  REFERRED_BONUS: 50    // Amount new user gets
};
```

## Database Schema

### Referral Model

```javascript
{
  userId: ObjectId,              // Owner of referral code
  referralCode: String,          // Static code (e.g., "NIR123")
  referralToken: String,         // Token for URL sharing
  totalReferrals: Number,        // Count of successful referrals
  totalEarnings: Number,         // Total earnings from referrals
  successfulReferrals: [{        // Array of referral records
    referredUserId: ObjectId,
    referredUserEmail: String,
    referredUserName: String,
    referralMethod: String,      // 'code' or 'token'
    referrerReward: Number,
    referredUserReward: Number,
    referralDate: Date,
    ipAddress: String,
    userAgent: String
  }],
  lastUsedIPs: [{               // IP tracking for abuse prevention
    ip: String,
    usedAt: Date
  }],
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Enhanced User Model

```javascript
{
  // ... existing fields
  referredBy: ObjectId,          // Who referred this user
  referralMethod: String,        // 'code' or 'token'
  referralRewardReceived: Boolean,
  referralRewardAmount: Number,
  tempReferralData: String       // Temporary storage during registration
}
```

## API Endpoints

### Public Endpoints

- `POST /api/referrals/validate` - Validate referral code/token

### Authenticated Endpoints

- `GET /referrals` - Referral dashboard page
- `GET /api/referrals/dashboard` - Get referral data
- `GET /api/referrals/stats` - Get referral statistics
- `GET /api/referrals/link` - Generate shareable link

## Registration Flow

### 1. Registration Form Enhancement

```html
<input type="text" name="referralCode" placeholder="Referral Code (Optional)" />
<small>Enter a friend's referral code to get ₹50 bonus</small>
```

### 2. URL Parameter Handling

```javascript
// Check for referral token in URL
const urlParams = new URLSearchParams(window.location.search);
const ref = urlParams.get('ref');

if (ref) {
  document.querySelector('input[name="referralCode"]').value = ref;
  // Show bonus message
}
```

### 3. Backend Validation

```javascript
// During registration
if (referralCode && referralCode.trim()) {
  const referralValidation = await validateReferral(
    referralCode.trim(), 
    email, 
    ipAddress
  );
  
  if (!referralValidation.valid) {
    return res.status(400).json({
      success: false,
      message: referralValidation.message
    });
  }
  
  // Store referral data for OTP verification
  referralData = referralValidation;
}
```

### 4. Reward Processing After OTP Verification

```javascript
// After successful OTP verification
if (user.tempReferralData) {
  const tempData = JSON.parse(user.tempReferralData);
  
  const referralResult = await processReferralRewards(
    user._id,
    { 
      referral: { _id: tempData.referralId },
      referrer: { _id: tempData.referrerId }
    },
    tempData.ipAddress,
    tempData.userAgent
  );

  if (referralResult.success) {
    referralMessage = ` You've received ₹${referralResult.referredReward} welcome bonus!`;
  }
}

// Create referral record for new user
await createReferralRecord(user._id, user.name);
```

## Security Features

### 1. Abuse Prevention

- **IP Tracking**: Prevents multiple referrals from same IP within 24 hours
- **Email Validation**: Prevents duplicate registrations with same email
- **Self-Referral Prevention**: Users cannot refer themselves

### 2. Validation Rules

```javascript
// Referral validation checks
const validateReferral = async (identifier, newUserEmail, ipAddress) => {
  // Check if referral exists and is active
  // Check if referrer account is active
  // Check for self-referral attempt
  // Check for IP abuse
  // Check for duplicate referral
};
```

### 3. Transaction Integrity

- Database transactions ensure atomic operations
- Wallet updates are logged with transaction records
- Rollback on failure to maintain data consistency

## Dashboard Features

### 1. Statistics Display

- Total referrals count
- Total earnings amount
- Recent referrals (last 30 days)
- Referral success rate

### 2. Sharing Options

- Copy referral code
- Copy referral link
- WhatsApp sharing
- Telegram sharing
- Social media integration

### 3. Recent Referrals List

- Referred user names
- Registration dates
- Reward amounts
- Referral methods used

## Testing

### Test Script

Run `node test/testReferralSystem.js` to verify:

1. **Referral Record Creation** - Tests code and token generation
2. **Validation Logic** - Tests various validation scenarios
3. **Abuse Prevention** - Tests IP blocking and self-referral prevention
4. **Reward Processing** - Tests complete referral flow
5. **Statistics** - Tests data aggregation and reporting

### Manual Testing Checklist

- [ ] Register with referral code from form
- [ ] Register with referral token from URL
- [ ] Verify wallet bonuses are credited
- [ ] Check referral dashboard displays correctly
- [ ] Test sharing functionality
- [ ] Verify abuse prevention works
- [ ] Test invalid referral codes
- [ ] Check transaction logging

## Configuration

### Environment Variables

```env
BASE_URL=http://localhost:3000  # For generating referral URLs
```

### Reward Amounts

```javascript
const REFERRAL_REWARDS = {
  REFERRER_BONUS: 100,  // Configurable in service file
  REFERRED_BONUS: 50    // Configurable in service file
};
```

## Error Handling

### Common Error Scenarios

1. **Invalid Referral Code**: "Invalid referral code or token"
2. **Self-Referral**: "You cannot refer yourself"
3. **IP Abuse**: "This referral has been used recently from your location"
4. **Inactive Referrer**: "Referrer account is not active"
5. **Duplicate Referral**: "You have already been referred by this user"

### Graceful Degradation

- Registration continues even if referral processing fails
- Referral record creation failure doesn't block user creation
- Wallet transaction failures are logged but don't break flow

## Performance Considerations

### Database Optimization

- Indexes on referral codes and tokens for fast lookups
- Compound indexes for referral validation queries
- Pagination for referral history displays

### Caching Strategy

- Cache referral statistics for dashboard
- Cache user referral information
- Use Redis for session-based referral data

## Future Enhancements

### Potential Features

1. **Tiered Rewards** - Different rewards based on referral count
2. **Time-Limited Bonuses** - Special promotional periods
3. **Referral Contests** - Leaderboards and competitions
4. **Advanced Analytics** - Conversion tracking and insights
5. **Referral Expiry** - Time-limited referral validity
6. **Custom Referral Codes** - Allow users to choose their codes

### Scalability Improvements

1. **Microservices** - Separate referral service
2. **Event-Driven Architecture** - Async reward processing
3. **Advanced Fraud Detection** - ML-based abuse detection
4. **Multi-Level Referrals** - Pyramid-style referral system

## Monitoring & Analytics

### Key Metrics

- Referral conversion rate
- Average referral value
- Top referrers
- Referral source analysis
- Fraud detection alerts

### Logging

- All referral activities are logged
- Transaction records for audit trails
- Error logging for debugging
- Performance metrics for optimization

## Conclusion

The referral system provides a comprehensive solution for user acquisition through incentivized referrals. It combines security, usability, and scalability while maintaining data integrity and preventing abuse. The dual approach of static codes and token-based links offers flexibility for different sharing scenarios, while the wallet integration provides immediate value to both referrers and new users.