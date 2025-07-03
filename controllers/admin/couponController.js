import { Coupon } from "../../model/couponModel.js";
import { Category } from "../../model/categoryModel.js";
import { Product } from "../../model/productModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";

// Get all coupons for admin
export const getCoupons = catchAsyncError(async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    let query = {};
    if (search) {
      query = {
        $or: [
          { code: new RegExp(search, 'i') },
          { description: new RegExp(search, 'i') }
        ]
      };
    }

    const coupons = await Coupon.find(query)
      .populate('applicableCategories', 'name')
      .populate('applicableProducts', 'productName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCoupons = await Coupon.countDocuments(query);
    const totalPages = Math.ceil(totalCoupons / limit);

    res.render("admin/coupons", {
      coupons,
      currentPage: page,
      totalPages,
      totalCoupons,
      search,
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading coupons:", error);
    return next(new ErrorHandler("Failed to load coupons", 500));
  }
});

// Get add coupon page
export const getAddCoupon = catchAsyncError(async (req, res, next) => {
  try {
    const categories = await Category.find({ isListed: true }).sort({ name: 1 });
    const products = await Product.find({ 
      status: 'Available', 
      isBlocked: false, 
      isDeleted: false 
    }).populate('category').sort({ productName: 1 });

    res.render("admin/add-coupon", {
      categories,
      products,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading add coupon page:", error);
    return next(new ErrorHandler("Failed to load add coupon page", 500));
  }
});

// Create new coupon
export const createCoupon = catchAsyncError(async (req, res, next) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minimumAmount,
      maximumDiscount,
      usageLimit,
      validFrom,
      validUntil,
      applicableCategories,
      applicableProducts
    } = req.body;

    // Validation
    if (!code || !description || !discountType || !discountValue || !validFrom || !validUntil) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled'
      });
    }

    // Validate discount value
    if (discountValue <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Discount value must be greater than 0'
      });
    }

    if (discountType === 'percentage' && discountValue > 100) {
      return res.status(400).json({
        success: false,
        message: 'Percentage discount cannot exceed 100%'
      });
    }

    // Validate dates
    const fromDate = new Date(validFrom);
    const toDate = new Date(validUntil);
    const now = new Date();

    if (fromDate >= toDate) {
      return res.status(400).json({
        success: false,
        message: 'Valid until date must be after valid from date'
      });
    }

    if (toDate <= now) {
      return res.status(400).json({
        success: false,
        message: 'Valid until date must be in the future'
      });
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }

    // Create coupon data
    const couponData = {
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue: parseFloat(discountValue),
      minimumAmount: parseFloat(minimumAmount) || 0,
      maximumDiscount: maximumDiscount ? parseFloat(maximumDiscount) : null,
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      validFrom: fromDate,
      validUntil: toDate,
      applicableCategories: applicableCategories || [],
      applicableProducts: applicableProducts || []
    };

    console.log('Creating coupon with data:', couponData);

    const coupon = new Coupon(couponData);
    await coupon.save();

    console.log('Coupon created successfully:', {
      id: coupon._id,
      code: coupon.code,
      applicableCategories: coupon.applicableCategories,
      applicableProducts: coupon.applicableProducts
    });

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon
    });
  } catch (error) {
    console.error("Error creating coupon:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create coupon'
    });
  }
});

// Get edit coupon page
export const getEditCoupon = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const coupon = await Coupon.findById(id)
      .populate('applicableCategories')
      .populate('applicableProducts');
    
    if (!coupon) {
      return res.redirect('/admin/coupons?error=Coupon not found');
    }

    const categories = await Category.find({ isListed: true }).sort({ name: 1 });
    const products = await Product.find({ 
      status: 'Available', 
      isBlocked: false, 
      isDeleted: false 
    }).populate('category').sort({ productName: 1 });

    res.render("admin/edit-coupon", {
      coupon,
      categories,
      products,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading edit coupon page:", error);
    return res.redirect('/admin/coupons?error=Failed to load coupon');
  }
});

// Update coupon
export const updateCoupon = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      code,
      description,
      discountType,
      discountValue,
      minimumAmount,
      maximumDiscount,
      usageLimit,
      validFrom,
      validUntil,
      applicableCategories,
      applicableProducts,
      isActive
    } = req.body;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Validation
    if (!code || !description || !discountType || !discountValue || !validFrom || !validUntil) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled'
      });
    }

    // Validate discount value
    if (discountValue <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Discount value must be greater than 0'
      });
    }

    if (discountType === 'percentage' && discountValue > 100) {
      return res.status(400).json({
        success: false,
        message: 'Percentage discount cannot exceed 100%'
      });
    }

    // Validate dates
    const fromDate = new Date(validFrom);
    const toDate = new Date(validUntil);

    if (fromDate >= toDate) {
      return res.status(400).json({
        success: false,
        message: 'Valid until date must be after valid from date'
      });
    }

    // Check if coupon code already exists (excluding current coupon)
    if (code.toUpperCase() !== coupon.code) {
      const existingCoupon = await Coupon.findOne({ 
        code: code.toUpperCase(),
        _id: { $ne: id }
      });
      if (existingCoupon) {
        return res.status(400).json({
          success: false,
          message: 'Coupon code already exists'
        });
      }
    }

    // Update coupon
    coupon.code = code.toUpperCase();
    coupon.description = description;
    coupon.discountType = discountType;
    coupon.discountValue = parseFloat(discountValue);
    coupon.minimumAmount = parseFloat(minimumAmount) || 0;
    coupon.maximumDiscount = maximumDiscount ? parseFloat(maximumDiscount) : null;
    coupon.usageLimit = usageLimit ? parseInt(usageLimit) : null;
    coupon.validFrom = fromDate;
    coupon.validUntil = toDate;
    coupon.applicableCategories = applicableCategories || [];
    coupon.applicableProducts = applicableProducts || [];
    coupon.isActive = isActive === 'true';

    await coupon.save();

    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      coupon
    });
  } catch (error) {
    console.error("Error updating coupon:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update coupon'
    });
  }
});

// Delete coupon
export const deleteCoupon = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Check if coupon has been used
    if (coupon.usedCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete coupon that has been used by customers'
      });
    }

    await Coupon.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete coupon'
    });
  }
});

// Toggle coupon status
export const toggleCouponStatus = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.status(200).json({
      success: true,
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: coupon.isActive
    });
  } catch (error) {
    console.error("Error toggling coupon status:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update coupon status'
    });
  }
});

// Get coupon details
export const getCouponDetails = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id)
      .populate('applicableCategories', 'name')
      .populate('applicableProducts', 'productName')
      .populate('usedBy.user', 'name email');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    res.status(200).json({
      success: true,
      coupon
    });
  } catch (error) {
    console.error("Error getting coupon details:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get coupon details'
    });
  }
});