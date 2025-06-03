import {User } from "../../model/userModel.js"
import mongoose from "mongoose"
import bcrypt from "bcrypt"
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import { sendToken } from "../../utils/sendToken.js";


export const loadLogin=catchAsyncError(async (req, res, next) =>{
    if(req.admin){
        return res.redirect('/admin/dashboard')
    }
    res.render('admin-login',{message:null})
})

export const adminLogin = catchAsyncError(async (req, res, next) => {
    try {
        const { email, password } = req.body;


        if (!email || !password) {
            return res.status(400).send("Email and password are required");
        }

       const admin = await User.findOne({ email, isAdmin: true }).select('+password');


        console.log("Fetched Admin:", admin);

        if (!admin) {

            return res.redirect('/login');
        }


        if (!admin.password) {
             return res.redirect('/login');
        }

        console.log("Admin Password Hash:", admin.password);


        const isPasswordMatched = await bcrypt.compare(password, admin.password);


        if (!isPasswordMatched) {
            console.log("Password mismatch");
            return res.redirect('/admin-login');
        }


         sendToken(admin, res);
       return  res.redirect('/admin/dashboard')


    } catch (error) {
        console.log("Login error:", error.message);
        res.status(500).send("Server Error");
    }
});



export const loadAdminDashboard= catchAsyncError(async (req, res, next) => {
    if(req.admin){
        try {
            res.render('dashboard')
        } catch (err) {
            res.redirect('/pageNotFound')
        }
    }
})

export const adminLogout = catchAsyncError(async(req,res,next) => {
  // Enhanced cache clearing headers for admin logout
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, private, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "-1");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Last-Modified", new Date().toUTCString());
  res.setHeader("ETag", "");
  res.setHeader("Clear-Site-Data", '"cache", "storage", "executionContexts"');

  // Clear the authentication cookie
  res.cookie("token","",{
    expires: new Date(0),
    httpOnly:true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  })

  // Clear any other session-related cookies
  res.clearCookie('connect.sid');

  res.redirect('/admin/admin-login')
})