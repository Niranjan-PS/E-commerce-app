
import ErrorHandler from "../middlewares/error.js";
import { catchAsyncError } from "./catchAsync.js";
import { User } from "../model/userModel.js";
import jwt  from "jsonwebtoken";

export const isAuthenticated = catchAsyncError(async(req,res,next)=>{

    authNoCache(req, res, () => {});

   
    const token= req.cookies.userToken
    console.log("cokkiess",req.cookies)
    if(!token){
      
       return res.redirect('/login')
    }

    try {
        const decoded = jwt.verify(token,process.env.JWT_SECRET_KEY)
        
        const userId = decoded.userId || decoded.id
        req.user =  await User.findById(userId)

       
        if(!req.user) {
            res.clearCookie('userToken');
            return res.redirect('/login?error=User not found');
        }

        
        if(req.user.isBlocked) {
            res.clearCookie('userToken');
           
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
        res.clearCookie('userToken');
        return res.redirect('/login?error=Invalid session');
    }
})

export const isAdminAuthenticated = catchAsyncError(async(req,res,next)=>{
    
    authNoCache(req, res, () => {});

    const token= req.cookies.adminToken
    console.log("Admin cookies:",req.cookies)
    if(!token){
        
        if(req.path.startsWith('/admin/api/') || req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({
                success: false,
                message: 'Admin authentication required',
                redirect: '/admin/admin-login'
            });
        }
        return res.redirect('/admin/admin-login')
    }

    try {
        const decoded = jwt.verify(token,process.env.JWT_SECRET_KEY)
        
        const userId = decoded.userId || decoded.id
        const admin = await User.findById(userId)

        if(!admin || !admin.isAdmin) {
            res.clearCookie('adminToken');
            // Check if this is an API request
            if(req.path.startsWith('/admin/api/') || req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({
                    success: false,
                    message: 'Admin authentication required',
                    redirect: '/admin/admin-login'
                });
            }
            return res.redirect('/admin/admin-login')
        }

        req.admin = admin
        console.log("admin is ",req.admin)
        next()
    } catch (error) {
        res.clearCookie('adminToken');
        // Check if this is an API request
        if(req.path.startsWith('/admin/api/') || req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({
                success: false,
                message: 'Admin authentication required',
                redirect: '/admin/admin-login'
            });
        }
        return res.redirect('/admin/admin-login')
    }
})

export const noCache = (_req, res, next) => {
 
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Last-Modified", new Date().toUTCString());
  res.setHeader("ETag", "");

  
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");

  
  res.setHeader("Vary", "User-Agent, Accept-Encoding");

  next();
};


export const authNoCache = (_req, res, next) => {
 
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, private, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "-1");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Last-Modified", new Date().toUTCString());
  res.setHeader("ETag", "");

 
  res.setHeader("Clear-Site-Data", '"cache", "storage"');

  next();
};