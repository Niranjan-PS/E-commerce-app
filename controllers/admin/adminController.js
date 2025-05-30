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