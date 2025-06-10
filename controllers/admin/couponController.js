import { Coupon } from "../../model/couponModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";

// Create dummy coupons for testing
export const createDummyCoupons = catchAsyncError(async (req, res, next) => {
  try {
    // Check if coupons already exist
    const existingCoupons = await Coupon.find();
    if (existingCoupons.length > 0) {
      return res.status(200).json({
        success: true,
        message: "Dummy coupons already exist"
      });
    }

    const dummyCoupons = [
      {
        code: "WELCOME10",
        description: "Welcome discount for new customers",
        discountType: "percentage",
        discountValue: 10,
        minimumAmount: 50,
        maximumDiscount: 20,
        usageLimit: 100,
        isActive: true,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      },
      {
        code: "SAVE20",
        description: "Save $20 on orders over $100",
        discountType: "fixed",
        discountValue: 20,
        minimumAmount: 100,
        usageLimit: 50,
        isActive: true,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days
      },
      {
        code: "LUXURY15",
        description: "15% off on luxury items",
        discountType: "percentage",
        discountValue: 15,
        minimumAmount: 75,
        maximumDiscount: 50,
        usageLimit: 75,
        isActive: true,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000) // 45 days
      }
    ];

    await Coupon.insertMany(dummyCoupons);

    res.status(201).json({
      success: true,
      message: "Dummy coupons created successfully",
      coupons: dummyCoupons
    });
  } catch (error) {
    console.error("Error creating dummy coupons:", error);
    return next(new ErrorHandler("Failed to create dummy coupons", 500));
  }
});

// Validate coupon
export const validateCoupon = catchAsyncError(async (req, res, next) => {
  try {
    const { code, amount } = req.body;

    if (!code || !amount) {
      return res.status(400).json({
        success: false,
        message: "Coupon code and amount are required"
      });
    }

    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Invalid coupon code"
      });
    }

    if (!coupon.isValid()) {
      return res.status(400).json({
        success: false,
        message: "Coupon has expired or reached usage limit"
      });
    }

    if (amount < coupon.minimumAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of $${coupon.minimumAmount} required`
      });
    }

    const discount = coupon.calculateDiscount(amount);

    res.status(200).json({
      success: true,
      message: "Coupon is valid",
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discount: discount,
        finalAmount: amount - discount
      }
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    return next(new ErrorHandler("Failed to validate coupon", 500));
  }
});

// Get all active coupons
export const getActiveCoupons = catchAsyncError(async (req, res, next) => {
  try {
    const coupons = await Coupon.find({ isActive: true })
      .select('code description discountType discountValue minimumAmount validUntil')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      coupons
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    return next(new ErrorHandler("Failed to fetch coupons", 500));
  }
});