import express from "express";
import jwt from "jsonwebtoken";
import {
  register,
  verifyOtp,
  resendOtp,
  login,
  logout,
  forgotPassword,
  resetPassword,
  loadHomePage,
  loadShopPage,
  getProductDetails,
  checkUserStatus,
  pagenotFound
} from "../controllers/userController.js";
import {
  createDummyCoupons,
  validateCoupon,
  getActiveCoupons
} from "../controllers/couponController.js";
import {
  addReview,
  getProductReviews,
  updateReview,
  deleteReview
} from "../controllers/reviewController.js";
import { isAuthenticated } from "../middlewares/auth.js";
import { getUserProductList } from "../controllers/userProductController.js";
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
  res.render('user/register');
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
  res.render('user/login', { error: 'Invalid email or password' });
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

router.get("/password/forgot", (req, res) => {
  res.render("user/forgot-password");
});

router.post("/password/forgot", forgotPassword);

router.get("/password/reset/:token", (req, res) => {
  const { token } = req.params;
  res.render("user/reset-password", { token });
});

router.post("/password/reset/:token", resetPassword);

router.get('/google', (req, res, next) => {
  console.log('🔗 Google OAuth initiated');
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  console.log('🔄 Google OAuth callback received');
  passport.authenticate('google', {
    failureRedirect: '/login?error=Google authentication failed',
    session: false
  }, (err, user, info) => {
    if (err) {
      console.error('❌ Google OAuth error:', err);
      return res.redirect('/login?error=Authentication error occurred');
    }
    if (!user) {
      console.error('❌ Google OAuth failed - no user returned:', info);
      return res.redirect('/login?error=Google authentication failed');
    }

    console.log('✅ Google OAuth successful for user:', user.email);

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    console.log('🍪 JWT token set for user:', user.email);
    res.redirect('/home');
  })(req, res, next);
});

router.get("/user-products", getUserProductList);

router.get("/pageNotFound", pagenotFound);

export default router;
