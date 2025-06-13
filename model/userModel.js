import mongoose from "mongoose";
import bcrypt from "bcrypt"
import jwt  from "jsonwebtoken";
import crypto from "crypto"
const userSchema= new mongoose.Schema({
    name: String,
    email: String,
    password:{
        type:String,
        minLength: [8,"password must have atleast 8 characters"],
        maxLength: [32,"password cannot have more than 32 characters"],
        select: false,
    },
    phone:{
        type:String,

        default:null,

    } ,

    verificationMethod:String,
    verificationCode:Number,
    verificationCodeExpire:Date,
    lastOtpResend: { type: Date },
    resetPasswordToken:String,
    resetPasswordExpire:Date,
    createdAt:{
        type: Date,
        default: Date.now,
    },
    accountverified: {
       type: Boolean,
       default: false,
},
    isAdmin:{
       type: Boolean,
       default:false,
},
    isBlocked:{
      type: Boolean,
      default:false,
    },
    googleId: {
      type: String,
      default: null
    },
    profileImage: {
      type: String,
      default: null
    },
    address: {
      street: {
        type: String,
        default: null
      },
      city: {
        type: String,
        default: null
      },
      state: {
        type: String,
        default: null
      },
      zipCode: {
        type: String,
        default: null
      },
      country: {
        type: String,
        default: null
      }
    },
    emailVerificationToken: {
      type: String,
      default: null
    },
    emailVerificationExpire: {
      type: Date,
      default: null
    },
    pendingEmail: {
      type: String,
      default: null
    },
    wallet: {
      type: Number,
      default: 0,
      min: 0
    }




})
userSchema.pre("save", async function(next) {

    if (!this.isModified("password") || this.isAdmin) {
        return next();
    }

    this.password = await bcrypt.hash(this.password, 10);
    next();
});


userSchema.methods.comparePassword = async function(enteredPassword){
return await bcrypt.compare(enteredPassword,this.password)
}

userSchema.methods.generateVerificationCode = function(){
    function generateRandomFiveDigitNumber(){
        const fDigit= Math.floor(Math.random()*9)+1
        const remainingDigits = Math.floor(Math.random()*10000)
        .toString()
        .padStart(4,0)
        return parseInt(fDigit+remainingDigits)
    }
    const verificationCode=generateRandomFiveDigitNumber()
    this.verificationCode=verificationCode
    this.verificationCodeExpire = new Date(Date.now() + 30*1000) 

return verificationCode
}

userSchema.methods.generateToken = function () {
    return jwt.sign(
        {
            userId: this._id,
            isAdmin: this.isAdmin
        },
        process.env.JWT_SECRET_KEY,
        {
            expiresIn: process.env.JWT_EXPIRE
        }
    );
};

userSchema.methods.generateResetPasswordToken= function (){
    const resetToken= crypto.randomBytes(20).toString("hex")

    this.resetPasswordToken=crypto.createHash("sha256")
    .update(resetToken)
    .digest("hex")


    this.resetPasswordExpire=Date.now()+15*60*1000
     return resetToken
}

userSchema.methods.generateEmailVerificationToken = function() {
    const verificationToken = crypto.randomBytes(20).toString("hex")

    this.emailVerificationToken = crypto.createHash("sha256")
        .update(verificationToken)
        .digest("hex")

    this.emailVerificationExpire = Date.now() + 15*60*1000 
    return verificationToken
}

export const User = mongoose.model("User",userSchema)