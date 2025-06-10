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
  createDummyCoupons,
  validateCoupon,
  getActiveCoupons
} from "../controllers/admin/couponController.js";
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
  removeCoupon,
  placeOrder,
  getOrderSuccess
} from "../controllers/user/checkoutController.js";
import {
  getOrderDetails,
  getUserOrders,
  cancelOrder,
  returnOrder,
  downloadInvoice,
  markOrderDelivered
} from "../controllers/user/orderController.js";
import { profileUpload, processProfileImage } from "../helpers/multer.js";
import { isAuthenticated } from "../middlewares/auth.js";
import { getUserProductList } from "../controllers/user/userProductController.js";
import passport from "../passport.js";

const router = express.Router();

const setNoCacheHeaders = (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Vary', 'User-Agent');
  // Removed Clear-Site-Data header as it was causing unnecessary cache clearing
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
router.post('/resend-otp', resendOtp)

router.get('/login', (req, res) => {
  res.render('user/login', { error: req.query.error || null });
});

router.post("/login", login);

router.get("/", isAuthenticated, loadHomePage);
router.get("/home", isAuthenticated, loadHomePage);
router.get("/shop", isAuthenticated, loadShopPage);
router.get("/product/:id", isAuthenticated, getProductDetails);
router.get("/logout", isAuthenticated, logout);

// User status check route (for real-time blocking)
router.get("/check-status", checkUserStatus);

// Coupon routes
router.post("/create-dummy-coupons", createDummyCoupons);
router.post("/validate-coupon", isAuthenticated, validateCoupon);
router.get("/coupons", isAuthenticated, getActiveCoupons);

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
router.post("/addresses/add", isAuthenticated, addAddress);
router.get("/addresses/edit/:id", isAuthenticated, loadEditAddress);
router.post("/addresses/edit/:id", isAuthenticated, updateAddress);
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
router.post("/checkout/apply-coupon", isAuthenticated, applyCoupon);
router.post("/checkout/remove-coupon", isAuthenticated, removeCoupon);
router.post("/checkout/place-order", isAuthenticated, placeOrder);
router.get("/order-success/:orderId", isAuthenticated, getOrderSuccess);

// Order routes
router.get("/orders", isAuthenticated, getUserOrders);
router.get("/orders/:orderId", isAuthenticated, getOrderDetails);
router.post("/orders/:orderId/cancel", isAuthenticated, cancelOrder);
router.post("/orders/:orderId/return", isAuthenticated, returnOrder);
router.get("/orders/:orderId/invoice", isAuthenticated, downloadInvoice);
router.post("/orders/:orderId/mark-delivered", isAuthenticated, markOrderDelivered); 

router.get("/pageNotFound", pagenotFound);

export default router;