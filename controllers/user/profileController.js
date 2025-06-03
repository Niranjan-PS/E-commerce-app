import { User } from "../../model/userModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";
import { sendEmail } from "../../utils/sendEmail.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// View Profile
export const viewProfile = catchAsyncError(async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    res.render("user/profile", {
      user,
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading profile:", error);
    return next(new ErrorHandler("Failed to load profile", 500));
  }
});

// Load Edit Profile Page
export const loadEditProfile = catchAsyncError(async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    res.render("user/edit-profile", {
      user,
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading edit profile:", error);
    return next(new ErrorHandler("Failed to load edit profile page", 500));
  }
});

// Update Profile
export const updateProfile = catchAsyncError(async (req, res, next) => {
  try {
    const { name, phone, street, city, state, zipCode, country } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    // Validate phone number if provided
    if (phone && phone.trim()) {
      const cleanPhone = phone.trim().replace(/\s|-/g, "");
      const phoneRegex = /^\+91\d{10}$/;
      if (!phoneRegex.test(cleanPhone)) {
        return res.redirect('/profile/edit?error=Invalid phone number format. Use +91XXXXXXXXXX');
      }
      user.phone = cleanPhone;
    }

    // Update basic info
    if (name && name.trim()) user.name = name.trim();

    // Update address
    user.address = {
      street: street ? street.trim() : user.address?.street || null,
      city: city ? city.trim() : user.address?.city || null,
      state: state ? state.trim() : user.address?.state || null,
      zipCode: zipCode ? zipCode.trim() : user.address?.zipCode || null,
      country: country ? country.trim() : user.address?.country || null
    };

    // Handle profile image upload (cropped or traditional)
    if (req.body.croppedImageData) {
      try {
        // Handle cropped image
        const base64Data = req.body.croppedImageData;
        const base64Image = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Image, 'base64');

        // Generate unique filename
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const filename = `profile-cropped-${uniqueSuffix}.jpg`;

        // Define upload path
        const uploadPath = path.join(__dirname, "../../public/uploads/profile-images");
        const filePath = path.join(uploadPath, filename);

        // Ensure directory exists
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }

        // Delete old profile image if exists
        if (user.profileImage) {
          const oldImagePath = path.join(uploadPath, user.profileImage);
          fs.unlink(oldImagePath, (err) => {
            if (err) console.log("Error deleting old profile image:", err);
          });
        }

        // Save cropped image
        fs.writeFileSync(filePath, imageBuffer);
        user.profileImage = filename;
      } catch (error) {
        console.error('Error processing cropped profile image:', error);
        return res.redirect('/profile/edit?error=Error+processing+profile+image');
      }
    } else if (req.file) {
      // Handle traditional file upload
      // Delete old profile image if exists
      if (user.profileImage) {
        const oldImagePath = path.join(__dirname, "../../public/uploads/profile-images", user.profileImage);
        fs.unlink(oldImagePath, (err) => {
          if (err) console.log("Error deleting old profile image:", err);
        });
      }
      user.profileImage = req.file.filename;
    }

    await user.save();

    res.redirect('/profile?message=Profile updated successfully');
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.redirect('/profile/edit?error=Failed to update profile');
  }
});

// Request Email Change
export const requestEmailChange = catchAsyncError(async (req, res, next) => {
  try {
    const { newEmail } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    if (!newEmail || !newEmail.trim()) {
      return res.status(400).json({
        success: false,
        message: "New email is required"
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({
      email: newEmail.trim().toLowerCase(),
      _id: { $ne: user._id }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already in use"
      });
    }

    // Generate verification token
    const verificationToken = user.generateEmailVerificationToken();
    user.pendingEmail = newEmail.trim().toLowerCase();
    await user.save();

    // Send verification email
    const verificationUrl = `${req.protocol}://${req.get("host")}/profile/verify-email/${verificationToken}`;

    const message = `
      <h2>Email Change Verification</h2>
      <p>You have requested to change your email address to: <strong>${newEmail}</strong></p>
      <p>Click the link below to verify your new email address:</p>
      <a href="${verificationUrl}" target="_blank">${verificationUrl}</a>
      <p>This link will expire in 15 minutes.</p>
      <p>If you did not request this change, please ignore this email.</p>
    `;

    await sendEmail({
      email: newEmail,
      subject: "Verify Your New Email Address",
      message
    });

    res.status(200).json({
      success: true,
      message: "Verification email sent to your new email address"
    });

  } catch (error) {
    console.error("Error requesting email change:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send verification email"
    });
  }
});

// Verify Email Change
export const verifyEmailChange = catchAsyncError(async (req, res, next) => {
  try {
    const { token } = req.params;

    const emailVerificationToken = crypto.createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      emailVerificationToken,
      emailVerificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.redirect('/profile?error=Invalid or expired verification token');
    }

    // Update email
    user.email = user.pendingEmail;
    user.pendingEmail = null;
    user.emailVerificationToken = null;
    user.emailVerificationExpire = null;

    await user.save();

    res.redirect('/profile?message=Email updated successfully');
  } catch (error) {
    console.error("Error verifying email change:", error);
    return res.redirect('/profile?error=Failed to verify email change');
  }
});

// Load Change Password Page
export const loadChangePassword = catchAsyncError(async (req, res, next) => {
  try {
    res.render("user/change-password", {
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading change password page:", error);
    return next(new ErrorHandler("Failed to load change password page", 500));
  }
});

// Change Password
export const changePassword = catchAsyncError(async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.redirect('/profile/change-password?error=All fields are required');
    }

    if (newPassword !== confirmPassword) {
      return res.redirect('/profile/change-password?error=New passwords do not match');
    }

    if (newPassword.length < 8) {
      return res.redirect('/profile/change-password?error=New password must be at least 8 characters long');
    }

    // Check current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.redirect('/profile/change-password?error=Current password is incorrect');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.redirect('/profile?message=Password changed successfully');
  } catch (error) {
    console.error("Error changing password:", error);
    return res.redirect('/profile/change-password?error=Failed to change password');
  }
});

// Load Forgot Password Page
export const loadForgotPassword = catchAsyncError(async (req, res, next) => {
  try {
    res.render("user/forgot-password", {
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading forgot password page:", error);
    return next(new ErrorHandler("Failed to load forgot password page", 500));
  }
});

// Send Forgot Password Email
export const forgotPassword = catchAsyncError(async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.redirect('/forgot-password?error=Email is required');
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.redirect('/forgot-password?error=No account found with this email address');
    }

    // Generate reset token
    const resetToken = user.generateResetPasswordToken();
    await user.save();

    // Send reset email
    const resetUrl = `${req.protocol}://${req.get("host")}/reset-password/${resetToken}`;

    const message = `
      <h2>Password Reset Request</h2>
      <p>You have requested to reset your password for your Luxe Scents account.</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 10px 20px; background-color: #6200ea; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>Or copy and paste this link in your browser:</p>
      <p>${resetUrl}</p>
      <p>This link will expire in 15 minutes.</p>
      <p>If you did not request this password reset, please ignore this email.</p>
    `;

    await sendEmail({
      email: user.email,
      subject: "Password Reset Request - Luxe Scents",
      message
    });

    res.redirect('/forgot-password?message=Password reset email sent successfully. Please check your email.');
  } catch (error) {
    console.error("Error sending forgot password email:", error);
    return res.redirect('/forgot-password?error=Failed to send password reset email');
  }
});

// Load Reset Password Page
export const loadResetPassword = catchAsyncError(async (req, res, next) => {
  try {
    const { token } = req.params;

    const resetPasswordToken = crypto.createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.redirect('/forgot-password?error=Invalid or expired reset token');
    }

    res.render("user/reset-password", {
      token,
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading reset password page:", error);
    return res.redirect('/forgot-password?error=Invalid reset link');
  }
});

// Reset Password
export const resetPassword = catchAsyncError(async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
      return res.redirect(`/reset-password/${token}?error=All fields are required`);
    }

    if (password !== confirmPassword) {
      return res.redirect(`/reset-password/${token}?error=Passwords do not match`);
    }

    if (password.length < 8) {
      return res.redirect(`/reset-password/${token}?error=Password must be at least 8 characters long`);
    }

    const resetPasswordToken = crypto.createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.redirect('/forgot-password?error=Invalid or expired reset token');
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save();

    res.redirect('/login?message=Password reset successfully. Please login with your new password.');
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.redirect(`/reset-password/${req.params.token}?error=Failed to reset password`);
  }
});
