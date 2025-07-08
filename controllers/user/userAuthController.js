import dotenv from 'dotenv';
dotenv.config();
import crypto from "crypto"
import jwt from "jsonwebtoken";

import ErrorHandler from "../../middlewares/error.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import { User } from "../../model/userModel.js";
import twilio from "twilio";
import { sendEmail } from "../../utils/sendEmail.js";
import { sendToken } from '../../utils/sendToken.js';
import HttpStatus from '../../helpers/httpStatus.js';

import { Wallet } from '../../model/walletModel.js';
import { validateReferral, processReferralRewards, createReferralRecord } from '../../services/referralService.js';

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

export const register = catchAsyncError(async (req, res, next) => {
  try {

    console.log('Request body:', req.body);
    if (req.body) {
      console.log('userName :', req.body.userName);
      console.log('email :', req.body.email);
      console.log('phone :', req.body.phone);
    }
    if (!req.body || Object.keys(req.body).length === 0) {
      console.log(' req.body is undefined');
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "No form data received. Please try again."
      });
    }


    let { userName:name, email, phone, password, confirmPassword, verificationMethod, referralCode } = req.body;

    console.log('Destructured values:', { name, email, phone, password: password, verificationMethod, referralCode });

    if (!name || !email || !phone || !password || !confirmPassword|| !verificationMethod) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "All fields are required."
      });
    }
    if (password !== req.body.confirmPassword) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Passwords do not match."
      });
    }
phone = phone.trim();
phone = phone.replace(/\s|-/g, "");
phone = phone.replace(/[^\x20-\x7E]/g, '');
console.log("Cleaned phone:", phone);
    function validatePhoneNumber(phone) {
      const phoneRegex = /^\+91[6-9]\d{9}$/;
      return phoneRegex.test(phone);
    }
    if (!validatePhoneNumber(phone)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "InvalidMobilenumber."
      });
    }
    const existingUser = await User.findOne({
      $or: [
        { email, accountverified: true },
        { phone, accountverified: true },
      ],
    });

    if (existingUser) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Phone or Email is already used."
      });
    }

    // Validate referral if provided
    let referralData = null;
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    if (referralCode && referralCode.trim()) {
      const referralValidation = await validateReferral(referralCode.trim(), email, ipAddress);
      
      if (!referralValidation.valid) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: referralValidation.message
        });
      }
      
      referralData = referralValidation;
    }

    const userData = {
      name,
      email,
      phone,
      password,
      accountverified: false,
    };

    const user = await User.create(userData);
    await Wallet.create({ userId: user._id, balance: 0, transactions: [] });

    const verificationCode = user.generateVerificationCode();
    console.log(`Generated verification code: ${verificationCode} for user: ${name || email}`);


    // Store referral data in user session or temporary storage for OTP verification
    if (referralData) {
      user.tempReferralData = JSON.stringify({
        referralId: referralData.referral._id,
        referrerId: referralData.referrer._id,
        ipAddress,
        userAgent: req.get('User-Agent')
      });
    }

    await user.save();

    try {
      await sendVerificationCode(verificationMethod, verificationCode, email, phone, name);

      return res.status(HttpStatus.OK).json({
        success: true,
        message: "Verification code sent successfully",
        redirectUrl: `/otp-verification?email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}&method=${encodeURIComponent(verificationMethod)}`
      });
    } catch (sendError) {
      console.error("Error sending verification code:", sendError);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to send verification code. Please try again."
      });
    }

  } catch (error) {
    console.error("Error during registration:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Registration failed. Please try again."
    });
  }


});

async function sendVerificationCode(verificationMethod, verificationCode, email, phone, name, res = null) {
  try {
    console.log(`Sending verification code ${verificationCode} via ${verificationMethod} to ${email || phone}`);

    if (verificationMethod === "email") {

      const message = generateEmailTemplate(verificationCode);

      console.log(` email with verification code: ${verificationCode}`);


      await sendEmail({
        email,
        subject: "Your Verification Code",
        message
      });

      console.log(`Email verification code sent successfully to ${email}`);


      return { success: true, message: "OTP sent to email" };

    } else if (verificationMethod === "phone") {
      const verificationCodeWithSpace = verificationCode
        .toString()
        .split("")
        .join(" ");

      await client.calls.create({
        twiml: `<Response><Say>Your verification code is ${verificationCodeWithSpace}. Your verification code is ${verificationCodeWithSpace}</Say></Response>`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone,
      });

      console.log(`Phone verification code sent to ${phone}`);


      return { success: true, message: "OTP sent to phone" };
    } else {
      const errorMsg = "Invalid verification method";
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  } catch (error) {
    console.error("Error sending verification code:", error);
    throw error;
  }
}

function generateEmailTemplate(verificationCode) {

  const code = String(verificationCode);

  console.log(`Generating email template with code: ${code}`);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Verification Code</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; padding:30px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); max-width: 100%;">
          <tr>
            <td align="center" style="padding-bottom: 20px;">
              <h2 style="margin: 0; font-size: 24px; color: #333333;">Verify Your Email</h2>
            </td>
          </tr>
          <tr>
            <td style="font-size: 16px; color: #555555; padding-bottom: 20px;">
              <p style="margin: 0;">Hi there,</p>
              <p style="margin: 10px 0;">Use the code below to verify your email address:</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 20px;">
              <div style="display: inline-block; padding: 12px 24px; background-color: #f0f0f0; border-radius: 6px; font-size: 24px; font-weight: bold; letter-spacing: 3px; color: #333333;">
                ${code}
              </div>
            </td>
          </tr>
          <tr>
            <td style="font-size: 14px; color: #999999; text-align: center;">
              <p>This code will expire in 10 minutes.</p>
              <p>If you didn't request this, you can ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="text-align: center; padding-top: 30px; font-size: 12px; color: #bbbbbb;">
              &copy; ${new Date().getFullYear()} Your Company
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const verifyOtp = catchAsyncError(async(req,res,next) => {
  const {email, otp,phone} = req.body


  if (!otp) {
    return res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      message: "OTP is required."
    });
  }

  function validatePhoneNumber(phone) {
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  // if (!validatePhoneNumber(phone)) {
  //   return next(new ErrorHandler("Invalid phone number.", 400));
  // }

  try {
    const userAllEntries = await User.find({
      $or:[{
        email,
        accountverified:false,
      },
      {
        phone,
        accountverified:false,
      }
    ]
    }).sort({createdAt:-1})

    if (!userAllEntries || userAllEntries.length === 0){
      return res.status(HttpStatus.BAD_REQUEST).json({
        success:false,
        message :"User not Found"
      })
    }

  
    if(userAllEntries.length>1){
       var user=userAllEntries[0]
      await User.deleteOne({_id: {$ne : user._id},
        $or:[
          {phone, accountverified:false},
          {email,accountverified:false}
        ]
      })
    } else {
      user = userAllEntries[0]
    }

    const currentTime = Date.now();
    const verificationCodeExpire = new Date(user.verificationCodeExpire).getTime()
    console.log(currentTime,"this is the current time")
    console.log(verificationCodeExpire,"OTP expiration time")


    if(currentTime > verificationCodeExpire){
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "OTP has expired. Please request a new OTP."
      });
    }


    if(user.verificationCode !== Number(otp)){
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Invalid OTP. Please check and try again."
      });
    }

    user.accountverified = true
    user.verificationCode = null
    user.verificationCodeExpire = null

    // Process referral rewards if applicable
    let referralMessage = '';
    if (user.tempReferralData) {
      console.log('[Referral] Processing referral rewards for user:', user.email);
      try {
        const tempData = JSON.parse(user.tempReferralData);
        console.log('[Referral] Parsed tempReferralData:', tempData);
        
        // Get the actual referral and referrer objects
        const { Referral } = await import('../../model/referralModel.js');
        const referral = await Referral.findById(tempData.referralId).populate('userId');
        const referrer = await User.findById(tempData.referrerId);
        
        if (!referral || !referrer) {
          console.error('[Referral] Referral or referrer not found:', { referral: !!referral, referrer: !!referrer });
          throw new Error('Referral or referrer not found');
        }
        
        console.log('[Referral] Found referral and referrer, processing rewards...');
        
        // Process referral rewards
        const referralResult = await processReferralRewards(
          user._id,
          { 
            referral: referral,
            referrer: referrer
          },
          tempData.ipAddress,
          tempData.userAgent
        );

        console.log('[Referral] processReferralRewards result:', referralResult);

        if (referralResult && referralResult.success) {
          referralMessage = ` You've received ₹${referralResult.referredReward} welcome bonus and a coupon!`;
          console.log('[Referral] Referral rewards processed successfully');
        } else {
          console.warn('[Referral] Referral rewards processing returned unsuccessful result');
        }

      } catch (error) {
        console.error('[Referral] Error processing referral rewards:', error);
        console.error('[Referral] Error stack:', error.stack);
        // Don't fail registration if referral processing fails, but log the error
      } finally {
        // Always clear temporary referral data regardless of success/failure
        user.tempReferralData = null;
        console.log('[Referral] Cleared tempReferralData');
      }
    }

    // Create referral record for the new user
    try {
      await createReferralRecord(user._id, user.name);
    } catch (error) {
      console.error('Error creating referral record:', error);
      // Don't fail registration if referral record creation fails
    }

    await user.save({validateModifiedOnly:true})

    sendToken(user,res)
    console.log("Account verified successfully");
    return res.status(HttpStatus.OK).json({
      success: true,
      message: `Account verified successfully!${referralMessage}`,
      redirectUrl: "/login"
    });

  } catch (error) {
    console.error("Error in verifyOtp:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal Server Error. Please try again."
    });
  }
})

export const resendOtp = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
    return next(new ErrorHandler("Email is required.", HttpStatus.BAD_REQUEST));
  }
  try {
    console.log(`Resending OTP to email: ${email}`);
    const user = await User.findOne({
      email,
      accountverified: false,
    }).sort({ createdAt: -1 });

    if (!user) {
      console.log(`User not found or already verified for email: ${email}`);
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "User not found or already verified",
      });
    }


    const lastResend = user.lastOtpResend ? new Date(user.lastOtpResend).getTime() : 0;
    const currentTime = Date.now();
    const resendCooldown = 30 * 1000;

    if (lastResend && currentTime - lastResend < resendCooldown) {
      const waitTimeSeconds = Math.ceil((resendCooldown - (currentTime - lastResend)) / 1000);
      console.log(`OTP resend cooldown in effect. Need to wait ${waitTimeSeconds} seconds.`);
      return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        success: false,
        message: `Please wait ${waitTimeSeconds} seconds before requesting another OTP.`
      });
    }


    const verificationCode = user.generateVerificationCode();
    console.log(`Generated new verification code: ${verificationCode} for user: ${user.name || email}`);


    user.lastOtpResend = new Date(currentTime);
    await user.save({ validateModifiedOnly: true });


    try {
      const result = await sendVerificationCode("email", verificationCode, email, user.phone, user.name);
      console.log("Verification code send result:", result);


      return res.status(HttpStatus.OK).json({
        success: true,
        message: "Verification code has been sent to your email",
        code: verificationCode
      });
    } catch (sendError) {
      console.error("Error sending verification code:", sendError);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to send verification code. Please try again.",
        error: sendError.message
      });
    }
  } catch (error) {
    console.error("Error in resendOtp:", error);
    return next(new ErrorHandler("Failed to resend OTP.", HttpStatus.INTERNAL_SERVER_ERROR));
  }
});

export const login = catchAsyncError(async (req, res, next) => {
 console.log('Login route - Incoming request body:', req.body);
    const { email = '', password = '' } = req.body || {};
  if (!email || !password) {
    return next(new ErrorHandler("Invalid email or password. Please enter valid credentials", HttpStatus.BAD_REQUEST));
  }
  const user = await User.findOne({ email, accountverified: true }).select("+password");
  if (!user) {
    return next(new ErrorHandler("Invalid Credentials", HttpStatus.BAD_REQUEST));
  }

  const isPasswordMatched = await user.comparePassword(password);
  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid Password", HttpStatus.BAD_REQUEST));
  }
   if (user.isBlocked) {
    return res.status(HttpStatus.FORBIDDEN).json({
      success: false,
      message: "Your account has been blocked. Please contact support.",
      blocked: true,
    });
  }


  sendToken(user, res);
    
  let toastMessage = null;
  if (user.showReferralToast) {
    toastMessage = `Congratulations! You\'ve received a ₹${user.referralRewardAmount} referral bonus!`;
    user.showReferralToast = false;
    await user.save({ validateBeforeSave: false });
  }

  res.status(HttpStatus.OK).json({
      success: true,
      message: 'Login successful',
      user: { id: user._id, email: user.email },
      toastMessage
    });
});

export const logout = catchAsyncError(async(req,res,next) => {

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, private, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "-1");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Last-Modified", new Date().toUTCString());
  res.setHeader("ETag", "");
  res.setHeader("Clear-Site-Data", '"cache", "storage", "executionContexts"');


  res.cookie("userToken","",{
    expires: new Date(0),
    httpOnly:true,
    sameSite: 'strict'
  })

// if(isBlocked){
//   return res.clearCookie('token')
// }
  res.clearCookie('connect.sid');

  res.redirect('/login')
})

export const forgotPassword = catchAsyncError(async(req,res,next) => {
  const user = await User.findOne({
    email:req.body.email,
    accountverified: true})

  if(!user){
    return next(new ErrorHandler("User not found", HttpStatus.NOT_FOUND))
  }
  const resetToken = user.generateResetPasswordToken()

  await user.save({validateBeforeSave:false})
  const resetUrl = `${req.protocol}://${req.get("host")}/password/reset/${resetToken}`;


  const message = `
    <h2>Password Reset Requested</h2>
    <p>Click the link below to reset your password:</p>
    <a href="${resetUrl}" target="_blank">${resetUrl}</a>
    <p>If you did not request this, please ignore this email.</p>
  `;

  try {
    sendEmail({email:user.email,
      subject: "Password Reset Link",
      message,
    })


  } catch (error) {
    user.resetPasswordToken = undefined
    user.resetPasswordExpire = undefined

    await user.save({validateBeforeSave:false})
    return next(new ErrorHandler(error.message?error.message:" cannot sent reset token"))
  }
})

export const resetPassword = catchAsyncError(async(req,res,next) => {
  const {token} = req.params
  const resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex")
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire:{$gt:Date.now()}
  })

  if(!user){
    return next(new ErrorHandler("reset password token is inValid or has been expired",HttpStatus.BAD_REQUEST))
  }

  if(req.body.password !== req.body.confirmPassword){
    return next(new ErrorHandler(" password and confirm password is inValid or dosent match",HttpStatus.BAD_REQUEST))
  }

  user.password = await req.body.password
  user.resetPasswordToken = undefined
  user.resetPasswordExpire = undefined
  await user.save()

  
  sendToken(user,res)
  res.redirect('/login')
})


export const checkUserStatus = catchAsyncError(async (req, res, next) => {
  try {
    const token = req.cookies.userToken || req.cookies.adminToken
    if (!token) {
      return res.status(200).json({
        success: false,
        message: 'No token found',
        authenticated: false,
        blocked: false
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (err) {
      return res.status(200).json({
        success: false,
        message: 'Invalid token',
        authenticated: false,
        blocked: false
      });
    }

    const userId = decoded.userId || decoded.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(200).json({
        success: false,
        message: 'User not found',
        authenticated: false,
        blocked: false
      });
    }

   

    if (user.isAdmin) {
      return res.status(200).json({
        success: true,
        message: 'Admin user detected',
        authenticated: true,
        blocked: false,
        isAdmin: true
      });
    }

    if (user.isBlocked) {
      return res.status(200).json({
        success: false,
        message: 'You are blocked by admin',
        authenticated: false,
        blocked: true,
        userEmail: user.email
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User is active',
      authenticated: true,
      blocked: false,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error(" Error in checkUserStatus:", error.message);
    return res.status(200).json({
      success: false,
      message: 'Something went wrong',
      authenticated: false,
      blocked: false,
      error: error.message
    });
  }
});
