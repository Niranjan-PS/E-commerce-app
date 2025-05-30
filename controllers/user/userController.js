import dotenv from 'dotenv';
dotenv.config();
import crypto from "crypto"

import ErrorHandler from "../../middlewares/error.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import { User } from "../../model/userModel.js";
import twilio from "twilio";
import { Product } from '../../model/productModel.js';
import { Category } from '../../model/categoryModel.js';
import { sendEmail } from "../../utils/sendEmail.js";
import { sendToken } from '../../utils/sendToken.js';

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

export const register = catchAsyncError(async (req, res, next) => {
  try {

    let { userName:name, email, phone, password,confirmPassword, verificationMethod } = req.body;

    console.log(req.body);

    if (!name || !email || !phone || !password || !confirmPassword|| !verificationMethod) {
      return next(new ErrorHandler("All fields are required.", 400));
    }
    if (password !== req.body.confirmPassword) {
  return next(new ErrorHandler("Passwords do not match.", 400));
}

phone = phone.trim();
phone = phone.replace(/\s|-/g, "");
phone = phone.replace(/[^\x20-\x7E]/g, '');
console.log("Cleaned phone:", phone);


    function validatePhoneNumber(phone) {
      const phoneRegex = /^\+91\d{10}$/;
      return phoneRegex.test(phone);
    }
    if (!validatePhoneNumber(phone)) {
      return next(new ErrorHandler("InvalidMobilenumber.", 400));
    }

    const existingUser = await User.findOne({
      $or: [
        { email, accountverified: true },
        { phone, accountverified: true },
      ],
    });

    if (existingUser) {
      return next(new ErrorHandler("Phone or Email is already used.", 400));
    }

    const registrationAttemptsByUser = await User.find({
      $or: [
        { phone, accountverified: false },
        { email, accountverified: false },
      ],
    });

    // if (registrationAttemptsByUser.length > 3) {
    //   return next(new ErrorHandler("You have exceeded the maximum number of attempts(3).Please try again after 10 minutes.", 400));
    // }

    const userData = {
      name,
      email,
      phone,
      password,
      accountverified: false,
    };


    const user = await User.create(userData);


    const verificationCode = user.generateVerificationCode();
    console.log(`Generated verification code: ${verificationCode} for user: ${name || email}`);


    await user.save();

    try {

      await sendVerificationCode(verificationMethod, verificationCode, email, phone, name);


      return res.redirect(`/otp-verification?email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}&method=${encodeURIComponent(verificationMethod)}`);
    } catch (sendError) {
      console.error("Error sending verification code:", sendError);
      return next(new ErrorHandler("Failed to send verification code. Please try again.", 500));
    }

  } catch (error) {
    console.error("Error during registration:", error);
    return next(error);
  }


});

async function sendVerificationCode(verificationMethod, verificationCode, email, phone, name, res = null) {
  try {
    console.log(`Sending verification code ${verificationCode} via ${verificationMethod} to ${email || phone}`);

    if (verificationMethod === "email") {

      const message = generateEmailTemplate(verificationCode);

      console.log(`Sending email with verification code: ${verificationCode}`);


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

  function validatePhoneNumber(phone) {
    const phoneRegex = /^\+91\d{10}$/;
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
      return res.status(400).json({
        success:false,
        message :"User not Found"
      })
    }

    let user;
    if(userAllEntries.length>1){
      user=userAllEntries[0]
      await User.deleteOne({_id: {$ne : user._id},
        $or:[
          {phone, accountverified:false},
          {email,accountverified:false}
        ]
      })
    } else {
      user = userAllEntries[0]
    }

    if(user.verificationCode !== Number(otp)){
      return next(new ErrorHandler("Invalid OTP.", 400));
    }

    const currentTime = Date.now();
    const verificationCodeExpire = new Date(user.verificationCodeExpire).getTime()
    console.log(currentTime,"this is the current time")
    console.log(verificationCodeExpire,"hurry upp")


    if(currentTime > verificationCodeExpire){
      return next(new ErrorHandler("OTP expired.", 400));
    }

    user.accountverified = true
    user.verificationCode = null
    user.verificationCodeExpire = null
    await user.save({validateModifiedOnly:true})

    sendToken(user,res)
     return res.redirect("/login");

  } catch (error) {
    console.error("Error in verifyOtp:", error);
    return next(new ErrorHandler("Internal Server Error.Connect the Service Team", 400));
  }
})

export const resendOtp = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new ErrorHandler("Email is required.", 400));
  }

  try {
    console.log(`Resending OTP to email: ${email}`);


    const user = await User.findOne({
      email,
      accountverified: false,
    }).sort({ createdAt: -1 });

    if (!user) {
      console.log(`User not found or already verified for email: ${email}`);
      return res.status(400).json({
        success: false,
        message: "User not found or already verified",
      });
    }


    const lastResend = user.lastOtpResend ? new Date(user.lastOtpResend).getTime() : 0;
    const currentTime = Date.now();
    const resendCooldown = 2 * 60 * 1000;

    if (lastResend && currentTime - lastResend < resendCooldown) {
      const waitTimeSeconds = Math.ceil((resendCooldown - (currentTime - lastResend)) / 1000);
      console.log(`OTP resend cooldown in effect. Need to wait ${waitTimeSeconds} seconds.`);
      return next(new ErrorHandler(`Please wait ${waitTimeSeconds} seconds before requesting another OTP.`, 429));
    }


    const verificationCode = user.generateVerificationCode();
    console.log(`Generated new verification code: ${verificationCode} for user: ${user.name || email}`);


    user.lastOtpResend = new Date(currentTime);
    await user.save({ validateModifiedOnly: true });


    try {
      const result = await sendVerificationCode("email", verificationCode, email, user.phone, user.name);
      console.log("Verification code send result:", result);


      return res.status(200).json({
        success: true,
        message: "Verification code has been sent to your email",
        code: verificationCode
      });
    } catch (sendError) {
      console.error("Error sending verification code:", sendError);
      return res.status(500).json({
        success: false,
        message: "Failed to send verification code. Please try again.",
        error: sendError.message
      });
    }
  } catch (error) {
    console.error("Error in resendOtp:", error);
    return next(new ErrorHandler("Failed to resend OTP.", 500));
  }
});





export const login = catchAsyncError(async (req, res, next) => {
 console.log('Login route - Incoming request body:', req.body);


    const { email = '', password = '' } = req.body || {};

  if (!email || !password) {
    return next(new ErrorHandler("Invalid email or password. Please enter valid credentials", 400));
  }

  const user = await User.findOne({ email, accountverified: true }).select("+password");

  if (!user) {
    return next(new ErrorHandler("Invalid Credentials", 400));
  }

  const isPasswordMatched = await user.comparePassword(password);
  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid Password", 400));
  }

  sendToken(user, res);
 res.status(200).json({
      success: true,
      message: 'Login successful',
      user: { id: user._id, email: user.email }
    });
});

export const logout = catchAsyncError(async(req,res,next) => {
  res.cookie("token","",{
    expires: new Date(0),
    httpOnly:true,
  })

  res.redirect('/login')
})



export const forgotPassword = catchAsyncError(async(req,res,next) => {
  const user = await User.findOne({
    email:req.body.email,
    accountverified: true})

  if(!user){
    return next(new ErrorHandler("User not found", 404))
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
    return next(new ErrorHandler("reset password token is inValid or has been expired",400))
  }

  if(req.body.password !== req.body.confirmPassword){
    return next(new ErrorHandler(" password and confirm password is inValid or dosent match",400))
  }

  user.password = await req.body.password
  user.resetPasswordToken = undefined
  user.resetPasswordExpire = undefined
  await user.save()

  sendToken(user,res)
  res.redirect('/login')
})
export const loadHomePage = async (req, res) => {
  try {
    const { page = 1, section, search = '', category = '' } = req.query;
    const limit = section === 'featured' ? 4 : 8;
    const skip = (parseInt(page) - 1) * limit;


    const query = {
      status: 'Available',
      isBlocked: { $ne: true },
      isDeleted: { $ne: true }
    };


    if (search) {
      query.productName = { $regex: search, $options: 'i' };
    }
    if (category) {
      query.category = category;
    }


    if (req.get('X-Requested-With') === 'XMLHttpRequest') {
      let products;
      let totalProducts;

      if (section === 'featured') {

        query.isFeatured = true;
        products = await Product.find(query)
          .populate('category')
          .skip(skip)
          .limit(limit);
        totalProducts = await Product.countDocuments(query);
      } else if (section === 'latest') {

        products = await Product.find(query)
          .sort({ createdAt: -1 })
          .populate('category')
          .skip(skip)
          .limit(limit);
        totalProducts = await Product.countDocuments(query);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid section parameter. Use "featured" or "latest".'
        });
      }

      return res.json({
        success: true,
        products: products.map(product => ({
          _id: product._id,
          productName: product.productName,
          description: product.description,
          price: product.price,
          salePrice: product.salePrice,
          discount: product.discount,
          rating: product.rating,
          reviewCount: product.reviewCount,
          category: product.category ? product.category.name : 'Uncategorized',
          productImage: product.productImage || [],
          status: product.status,
          isFeatured: product.isFeatured
        })),
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalProducts / limit),
        searchQuery: search,
        categoryFilter: category
      });
    }


    const featuredProducts = await Product.find({
      status: 'Available',
      isBlocked: { $ne: true },
      isDeleted: { $ne: true },
      isFeatured: true
    })
      .populate('category')
      .limit(4);

    const latestProducts = await Product.find({
      status: 'Available',
      isBlocked: { $ne: true },
      isDeleted: { $ne: true }
    })
      .sort({ createdAt: -1 })
      .populate('category')
      .limit(8);

    const categories = await Category.find({ isListed: true });

    res.render('user/home', {
      featuredProducts,
      latestProducts,
      categories,
      user: req.user || null
    });
  } catch (err) {
    console.error('Error loading home page:', err);
    if (req.get('X-Requested-With') === 'XMLHttpRequest') {
      return res.status(500).json({
        success: false,
        message: 'Server error while fetching products.'
      });
    }
    res.redirect('/pagenotFound');
  }
};

export const loadShopPage = async (req, res) => {
  const searchQuery = req.query.search || "";
  const categoryFilter = req.query.category || "";
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = 8;
  const sortBy = req.query.sort || "";
  const minPrice = parseFloat(req.query.minPrice) || 0;
  const maxPrice = parseFloat(req.query.maxPrice) || Number.MAX_VALUE;
  const minRating = parseFloat(req.query.minRating) || 0;

  try {
    const categories = await Category.find({ isListed: true });

    // Set up filter to only show available and non-blocked products
    const filter = {
      status: "Available",
      isBlocked: { $ne: true },
      isDeleted: { $ne: true }
    };

    // Use the correct field name for search
    if (searchQuery) {
      filter.productName = { $regex: searchQuery, $options: "i" };
    }

    // Handle category filtering properly
    if (categoryFilter) {
      const cleanCategory = categoryFilter.replace(/^:/, '');
      const category = await Category.findOne({ name: cleanCategory });
      if (category) {
        filter.category = category._id;
      }
    }

    // Price range filtering
    if (minPrice > 0 || maxPrice < Number.MAX_VALUE) {
      filter.price = { $gte: minPrice, $lte: maxPrice };
    }

    // Rating filtering
    if (minRating > 0) {
      filter.rating = { $gte: minRating };
    }

    // Set up sorting
    let sortOptions = { createdAt: -1 }; // Default sort
    switch (sortBy) {
      case 'price_low_high':
        sortOptions = { price: 1 };
        break;
      case 'price_high_low':
        sortOptions = { price: -1 };
        break;
      case 'name_a_z':
        sortOptions = { productName: 1 };
        break;
      case 'name_z_a':
        sortOptions = { productName: -1 };
        break;
      case 'rating_high_low':
        sortOptions = { rating: -1 };
        break;
      case 'newest':
        sortOptions = { createdAt: -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const totalCount = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    const products = await Product.find(filter)
      .populate("category")
      .sort(sortOptions)
      .skip((page - 1) * itemsPerPage)
      .limit(itemsPerPage);

    // Check if the request is AJAX
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('application/json');

    if (isAjax) {
      // Return JSON for AJAX requests
      return res.json({
        success: true,
        products: products.map(product => ({
          _id: product._id,
          productName: product.productName,
          price: product.price,
          salePrice: product.salePrice,
          discount: product.discount,
          rating: product.rating,
          reviewCount: product.reviewCount,
          category: product.category ? product.category.name : 'Uncategorized',
          productImage: product.productImage || [],
          status: product.status
        })),
        categories: categories.map(category => ({
          _id: category._id,
          name: category.name
        })),
        totalPages,
        currentPage: page,
        searchQuery,
        categoryFilter,
        sortBy,
        minPrice,
        maxPrice,
        minRating
      });
    }

    // Otherwise, render the EJS template
    res.render("user/shop", {
      products,
      categories,
      searchQuery,
      categoryFilter,
      totalPages,
      currentPage: page,
      sortBy,
      minPrice,
      maxPrice,
      minRating,
      user: req.user || null,
      breadcrumbs: [
        { name: "Home", url: "/" },
        { name: "Shop", url: "/shop", active: true }
      ]
    });
  } catch (err) {
    console.error("Error loading shop page:", err);
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('application/json');
    if (isAjax) {
      return res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
    res.redirect('/pagenotFound')
  }
};

export const getProductDetails = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;

    // First check if product exists at all
    const productExists = await Product.findById(id).populate("category");

    if (!productExists) {
      return res.redirect('/shop?error=Product+not+found');
    }

    // Check if product is blocked, deleted, or unavailable
    if (productExists.isBlocked || productExists.isDeleted || productExists.status !== "Available") {
      return res.redirect('/shop?error=Product+is+not+available');
    }

    const product = productExists;


    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      status: "Available",
      isBlocked: { $ne: true },
      isDeleted: { $ne: true }
    })
    .populate("category")
    .limit(4);


    const categories = await Category.find({ isListed: true });


    res.render("user/product-details", {
      product,
      relatedProducts,
      categories,
      user: req.user || null,
      breadcrumbs: [
        { name: "Home", url: "/" },
        { name: "Shop", url: "/shop" },
        { name: product.productName, url: `/product/${product._id}`, active: true }
      ]
    });
  } catch (error) {
    console.error("Error fetching product details:", error);
    return next(new ErrorHandler("Error fetching product details", 500));
  }
});

export const checkUserStatus = catchAsyncError(async (req, res, next) => {
  try {
    const { token } = req.cookies;

    if (!token) {
      return res.status(200).json({
        success: false,
        message: 'No token found',
        authenticated: false,
        blocked: false
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(200).json({
        success: false,
        message: 'User not found',
        authenticated: false,
        blocked: false
      });
    }

    // Only return blocked: true if user is actually blocked
    if (user.isBlocked) {
      return res.status(200).json({
        success: false,
        message: 'Your account has been blocked. Please contact support.',
        authenticated: false,
        blocked: true
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
    // Don't treat token errors as blocking - just return unauthenticated
    return res.status(200).json({
      success: false,
      message: 'Invalid token',
      authenticated: false,
      blocked: false
    });
  }
});

export const pagenotFound = catchAsyncError(async (req, res, next) => {
  try {
    res.render("user/page-404")
  } catch (error) {
    console.error("Error rendering 404 page:", error);
    return next(new ErrorHandler("Sorry! Page not found", 404))
  }
})