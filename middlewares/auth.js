
import ErrorHandler from "../middlewares/error.js";
import { catchAsyncError } from "./catchAsync.js";
import { User } from "../model/userModel.js";
import jwt  from "jsonwebtoken";

export const isAuthenticated = catchAsyncError(async(req,res,next)=>{
    const {token}= req.cookies
    console.log("cokkiess",req.cookies)
    if(!token){
       return res.redirect('/login')
    }

    try {
        const decoded = jwt.verify(token,process.env.JWT_SECRET_KEY)
        // Handle both userId (from Google auth) and id (from regular auth)
        const userId = decoded.userId || decoded.id
        req.user =  await User.findById(userId)

        // Check if user exists 
        if(!req.user) {
            res.clearCookie('token');
            return res.redirect('/login?error=User not found');
        }

        // Check if user is blocked
        if(req.user.isBlocked) {
            res.clearCookie('token');
            // Check if it's an AJAX request
            if(req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({
                    success: false,
                    message: 'Your account has been blocked. Please contact support.',
                    blocked: true
                });
            }
            return res.redirect('/login?error=Your account has been blocked. Please contact support.');
        }

        console.log("user is ",req.user)
        next()
    } catch (error) {
        res.clearCookie('token');
        return res.redirect('/login?error=Invalid session');
    }
})

export const isAdminAuthenticated = catchAsyncError(async(req,res,next)=>{
    const {token}= req.cookies
    console.log("Admin cookies:",req.cookies)
    if(!token){
       return res.redirect('/admin/admin-login')
    }

    try {
        const decoded = jwt.verify(token,process.env.JWT_SECRET_KEY)
        // Handle both userId (from Google auth) and id (from regular auth)
        const userId = decoded.userId || decoded.id
        const admin = await User.findById(userId)

        if(!admin || !admin.isAdmin) {
            res.clearCookie('token');
            return res.redirect('/admin/admin-login')
        }

        req.admin = admin
        console.log("admin is ",req.admin)
        next()
    } catch (error) {
        res.clearCookie('token');
        return res.redirect('/admin/admin-login')
    }
})
export const noCache = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
};