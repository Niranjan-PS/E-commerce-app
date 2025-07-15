import express from "express";
import jwt from "jsonwebtoken";
import {
  register,
  verifyOtp,
  resendOtp,
  login,
  logout,
  checkUserStatus
  
} from "../controllers/user/userAuthController.js";
import {
  loadHomePage,
  loadShopPage,
  getProductDetails,pagenotFound} from "../controllers/user/userController.js"

import {
  addReview,
  getProductReviews,
  updateReview,
  deleteReview
} from "../controllers/user/reviewController.js";
import {
  viewProfile,
  loadEditProfile,
  updateProfile,
  requestEmailChange,
  verifyEmailChange,
  loadChangePassword,
  changePassword,
  loadForgotPassword,
  forgotPassword,
  loadResetPassword,
  resetPassword
} from "../controllers/user/profileController.js";
import {
  getAddresses,
  loadAddAddress,
  addAddress,
  loadEditAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getAddressesForCheckout
} from "../controllers/user/addressController.js";
import {
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
  getCartCount
} from "../controllers/user/cartController.js";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  getWishlistCount,
  moveToCart
} from "../controllers/user/wishlistController.js";
import {
  getCheckout,
  applyCoupon,
  applyReferralCoupon,
  removeCoupon,
  placeOrder,
  getOrderSuccess
} from "../controllers/user/checkoutController.js";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  handlePaymentFailure,
  getPaymentStatus
} from "../controllers/user/paymentController.js";
import {
  getOrderDetails,
  getUserOrders,
  cancelOrder,
  returnOrder,
  cancelOrderItem,
  returnOrderItem,
  requestIndividualItemReturn,
  downloadInvoice,
  markOrderDelivered
} from "../controllers/user/orderController.js";
import { profileUpload, processProfileImage, formDataUpload } from "../helpers/multer.js";
import { isAuthenticated } from "../middlewares/auth.js";
import { getUserProductList } from "../controllers/user/userProductController.js";
import {getWalletDetails} from "../controllers/user/walletController.js"
import {
  getReferralDashboard,
  generateShareableLink,
  getReferralStats,
  validateReferralCode,
  renderReferralDashboard
} from "../controllers/user/referralController.js";
import passport from "../passport.js";


const router = express.Router();

const setNoCacheHeaders = (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Vary', 'User-Agent');
  
  next();
};


router.use(setNoCacheHeaders);

router.get('/register', (req, res) => {
  res.render('user/register', { error: req.query.error || null });
});

router.get("/otp-verification", (req, res) => {
  const { email, phone, method } = req.query;
  console.log("OTP verification page requested with:", { email, phone, method });
  res.render("user/verify-otp", { email, phone, verificationMethod: method });
});

router.post("/register", register);
router.post('/otp-verification', verifyOtp);
router.post('/resend-otp', resendOtp )

router.get('/login', (req, res) => {
  res.render('user/login', { error: req.query.error || null });
});

router.post("/login", login);

router.get("/", isAuthenticated, loadHomePage);
router.get("/home", isAuthenticated, loadHomePage);
router.get("/shop", isAuthenticated, loadShopPage);
router.get("/product/:id", isAuthenticated, getProductDetails);
router.get("/logout", isAuthenticated, logout);


router.get("/check-status", checkUserStatus);


// Review routes
router.post("/reviews", isAuthenticated, addReview);
router.get("/reviews/:productId", getProductReviews);
router.put("/reviews/:reviewId", isAuthenticated, updateReview);
router.delete("/reviews/:reviewId", isAuthenticated, deleteReview);



router.get('/google', (req, res, next) => {
  console.log(' Google OAuth initiated');
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  console.log(' Google OAuth callback received');
  passport.authenticate('google', {
    failureRedirect: '/login?error=Google authentication failed',
    session: false
  }, (err, user, info) => {
    if (err) {
      console.error(' Google OAuth error:', err);
      return res.redirect('/login?error=Authentication error occurred');
    }
    if (!user) {
      console.error(' Google OAuth failed - no user returned:', info);
      return res.redirect('/login?error=Google authentication failed');
    }

    console.log(' Google OAuth successful for user:', user.email);

    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: '7d' });
    res.cookie('userToken', token, {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000 
    });

    console.log(' JWT token set for user:', user.email);
    res.redirect('/home');
  })(req, res, next);
});

router.get("/user-products", getUserProductList);

// Profile routes
router.get("/profile", isAuthenticated, viewProfile);
router.get("/profile/edit", isAuthenticated, loadEditProfile);
router.post("/profile/edit", isAuthenticated, profileUpload.single('profileImage'), processProfileImage, updateProfile);
router.post("/profile/change-email", isAuthenticated, requestEmailChange);
router.get("/profile/verify-email/:token", verifyEmailChange);
router.get("/profile/change-password", isAuthenticated, loadChangePassword);
router.post("/profile/change-password", isAuthenticated, changePassword);

// Forgot Password routes
router.get("/forgot-password", loadForgotPassword);
router.post("/forgot-password", forgotPassword);
router.get("/reset-password/:token", loadResetPassword);
router.post("/reset-password/:token", resetPassword);

// Address routes
router.get("/addresses", isAuthenticated, getAddresses);
router.get("/addresses/add", isAuthenticated, loadAddAddress);
router.post("/addresses/add", isAuthenticated, formDataUpload.none(), addAddress);
router.get("/addresses/edit/:id", isAuthenticated, loadEditAddress);
router.post("/addresses/edit/:id", isAuthenticated, formDataUpload.none(), updateAddress);
router.delete("/addresses/:id", isAuthenticated, deleteAddress);
router.post("/addresses/:id/default", isAuthenticated, setDefaultAddress);
router.get("/api/addresses", isAuthenticated, getAddressesForCheckout);

// Cart routes
router.get("/cart", isAuthenticated, getCart);
router.post("/cart/add", isAuthenticated, addToCart);
router.post("/cart/update", isAuthenticated, updateCartQuantity);
router.delete("/cart/remove/:productId", isAuthenticated, removeFromCart);
router.delete("/cart/clear", isAuthenticated, clearCart);
router.get("/api/cart/count", isAuthenticated, getCartCount);

// Wishlist routes
router.get("/wishlist", isAuthenticated, getWishlist);
router.post("/wishlist/add", isAuthenticated, addToWishlist);
router.delete("/wishlist/remove/:productId", isAuthenticated, removeFromWishlist);
router.delete("/wishlist/clear", isAuthenticated, clearWishlist);
router.get("/api/wishlist/count", isAuthenticated, getWishlistCount);
router.post("/wishlist/move-to-cart/:productId", isAuthenticated, moveToCart);

// Checkout routes
router.get("/checkout", isAuthenticated, getCheckout);
router.get("/checkout/available-coupons", isAuthenticated, async (req, res) => {
  try {
    const { Coupon } = await import("../model/couponModel.js");
    
    // Get all active coupons that are currently valid
    const now = new Date();
    const availableCoupons = await Coupon.find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $or: [
        { usageLimit: null },
        { $expr: { $lt: ["$usedCount", "$usageLimit"] } }
      ]
    }).select('code description discountType discountValue minimumAmount maximumDiscount validUntil applicableCategories applicableProducts usedBy')
    .populate('applicableCategories', 'name')
    .populate('applicableProducts', 'productName')
    .sort({ discountValue: -1 });

    // Filter out coupons already used by this user
    const userAvailableCoupons = availableCoupons.filter(coupon => {
      return !coupon.usedBy.some(usage => usage.user.toString() === req.user._id.toString());
    });

    res.json({
      success: true,
      coupons: userAvailableCoupons
    });
  } catch (error) {
    console.error("Error fetching available coupons:", error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available coupons'
    });
  }
});
router.post("/checkout/apply-coupon", isAuthenticated, applyCoupon);
router.post("/checkout/apply-referral-coupon", isAuthenticated, applyReferralCoupon);
router.post("/checkout/remove-coupon", isAuthenticated, removeCoupon);
router.post("/checkout/place-order", isAuthenticated, placeOrder);
router.get("/order-success/:orderId", isAuthenticated, getOrderSuccess);

// Payment routes
router.post("/payment/create-order", isAuthenticated, createRazorpayOrder);
router.post("/payment/verify", isAuthenticated, verifyRazorpayPayment);
router.post("/payment/failure", isAuthenticated, handlePaymentFailure);
router.get("/payment/status/:orderId", isAuthenticated, getPaymentStatus);
router.get("/payment-success/:orderId", isAuthenticated, (req, res) => {
  res.render("user/payment-success", { orderId: req.params.orderId });
});
router.get("/payment-failed/:orderId", isAuthenticated, (req, res) => {
  res.render("user/payment-failed", { orderId: req.params.orderId });
});

// Coupon validation route
router.post("/checkout/validate-coupon", isAuthenticated, async (req, res) => {
  try {
    const { Coupon } = await import("../model/couponModel.js");
    const { couponCode } = req.body;
    
    if (!couponCode) {
      return res.status(400).json({ success: false, message: 'Coupon code required' });
    }
    
    const coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase(),
      isActive: true 
    });
    
    if (!coupon) {
      return res.json({ 
        success: false, 
        message: 'Coupon not found',
        valid: false 
      });
    }
    
    const now = new Date();
    const isValid = coupon.isValid();
    
    let status = 'valid';
    let message = 'Coupon is valid';
    
    if (!isValid) {
      if (now < coupon.validFrom) {
        status = 'not_active_yet';
        message = `Coupon will be active from ${coupon.validFrom.toLocaleString()}`;
      } else if (now > coupon.validUntil) {
        status = 'expired';
        message = `Coupon expired on ${coupon.validUntil.toLocaleString()}`;
      } else if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        status = 'usage_limit_reached';
        message = 'Coupon usage limit reached';
      }
    }
    
    res.json({
      success: true,
      valid: isValid,
      status,
      message,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minimumAmount: coupon.minimumAmount,
        validFrom: coupon.validFrom,
        validUntil: coupon.validUntil,
        usedCount: coupon.usedCount,
        usageLimit: coupon.usageLimit
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// Order routes
router.get("/orders", isAuthenticated, getUserOrders);
router.get("/orders/:orderId", isAuthenticated, getOrderDetails);
router.post("/orders/:orderId/cancel", isAuthenticated, cancelOrder);
router.post("/orders/:orderId/return", isAuthenticated, returnOrder);
router.post("/orders/:orderId/items/:itemId/cancel", isAuthenticated, cancelOrderItem);
router.post("/orders/:orderId/items/:itemId/return", isAuthenticated, returnOrderItem);
router.post("/orders/:orderId/items/:itemId/return-individual", isAuthenticated, requestIndividualItemReturn);
router.get("/orders/:orderId/invoice", isAuthenticated, downloadInvoice);
router.post("/orders/:orderId/mark-delivered", isAuthenticated, markOrderDelivered);

router.get('/wallet', isAuthenticated, getWalletDetails);

// Referral routes
router.get("/referrals", isAuthenticated, renderReferralDashboard);
router.get("/api/referrals/dashboard", isAuthenticated, getReferralDashboard);
router.get("/api/referrals/stats", isAuthenticated, getReferralStats);
router.get("/api/referrals/link", isAuthenticated, generateShareableLink);
router.post("/api/referrals/validate", validateReferralCode);


router.get("/pageNotFound", pagenotFound);

export default router;