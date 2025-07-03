import { ProductOffer } from "../../model/productOfferModel.js";
import { Product } from "../../model/productModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";

// Get all product offers
export const getProductOffers = catchAsyncError(async (req, res, next) => {
  try {
    // Auto-disable expired offers
    await ProductOffer.disableExpiredOffers();

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';

    let query = {};
    
    if (search) {
      // Search by offer name or product name
      const products = await Product.find({
        productName: new RegExp(search, 'i')
      }).select('_id');
      
      query = {
        $or: [
          { offerName: new RegExp(search, 'i') },
          { product: { $in: products.map(p => p._id) } }
        ]
      };
    }

    if (status) {
      if (status === 'active') {
        const now = new Date();
        query.isActive = true;
        query.startDate = { $lte: now };
        query.endDate = { $gte: now };
      } else if (status === 'inactive') {
        query.isActive = false;
      } else if (status === 'expired') {
        const now = new Date();
        query.endDate = { $lt: now };
      } else if (status === 'upcoming') {
        const now = new Date();
        query.isActive = true;
        query.startDate = { $gt: now };
      }
    }

    const offers = await ProductOffer.find(query)
      .populate('product', 'productName price salePrice productImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalOffers = await ProductOffer.countDocuments(query);
    const totalPages = Math.ceil(totalOffers / limit);

    // Calculate statistics
    const now = new Date();
    const stats = {
      total: await ProductOffer.countDocuments(),
      active: await ProductOffer.countDocuments({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
      }),
      upcoming: await ProductOffer.countDocuments({
        isActive: true,
        startDate: { $gt: now }
      }),
      expired: await ProductOffer.countDocuments({
        endDate: { $lt: now }
      })
    };

    res.render("admin/product-offers", {
      offers,
      currentPage: page,
      totalPages,
      totalOffers,
      search,
      status,
      stats,
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading product offers:", error);
    return next(new ErrorHandler("Failed to load product offers", 500));
  }
});

// Get add product offer page
export const getAddProductOffer = catchAsyncError(async (req, res, next) => {
  try {
    const products = await Product.find({
      status: 'Available',
      isBlocked: false,
      isDeleted: false
    }).populate('category').sort({ productName: 1 });

    res.render("admin/add-product-offer", {
      products,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading add product offer page:", error);
    return next(new ErrorHandler("Failed to load add product offer page", 500));
  }
});

// Create new product offer
export const createProductOffer = catchAsyncError(async (req, res, next) => {
  try {
    const {
      product,
      offerName,
      discountPercentage,
      startDate,
      endDate,
      description
    } = req.body;

    console.log('Creating product offer with data:', req.body);

    // Validation
    if (!product || !offerName || !discountPercentage || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled'
      });
    }

    // Validate discount percentage
    const discount = parseFloat(discountPercentage);
    if (discount < 1 || discount > 90) {
      return res.status(400).json({
        success: false,
        message: 'Discount percentage must be between 1% and 90%'
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    if (end <= now) {
      return res.status(400).json({
        success: false,
        message: 'End date must be in the future'
      });
    }

    // Check if product exists
    const productExists = await Product.findById(product);
    if (!productExists) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check for overlapping offers
    const hasOverlap = await ProductOffer.hasOverlappingOffer(product, start, end);
    if (hasOverlap) {
      return res.status(400).json({
        success: false,
        message: 'An active offer already exists for this product during the specified period'
      });
    }

    // Create offer
    const offer = new ProductOffer({
      product,
      offerName: offerName.trim(),
      discountPercentage: discount,
      startDate: start,
      endDate: end,
      description: description ? description.trim() : ''
    });

    await offer.save();

    console.log('Product offer created successfully:', {
      id: offer._id,
      offerName: offer.offerName,
      product: offer.product,
      discountPercentage: offer.discountPercentage
    });

    res.status(201).json({
      success: true,
      message: 'Product offer created successfully',
      offer
    });
  } catch (error) {
    console.error("Error creating product offer:", error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create product offer'
    });
  }
});

// Get edit product offer page
export const getEditProductOffer = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const offer = await ProductOffer.findById(id).populate('product');
    if (!offer) {
      return res.redirect('/admin/product-offers?error=Product offer not found');
    }

    const products = await Product.find({
      status: 'Available',
      isBlocked: false,
      isDeleted: false
    }).populate('category').sort({ productName: 1 });

    res.render("admin/edit-product-offer", {
      offer,
      products,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading edit product offer page:", error);
    return res.redirect('/admin/product-offers?error=Failed to load product offer');
  }
});

// Update product offer
export const updateProductOffer = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      product,
      offerName,
      discountPercentage,
      startDate,
      endDate,
      description,
      isActive
    } = req.body;

    const offer = await ProductOffer.findById(id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Product offer not found'
      });
    }

    // Validation
    if (!product || !offerName || !discountPercentage || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled'
      });
    }

    // Validate discount percentage
    const discount = parseFloat(discountPercentage);
    if (discount < 1 || discount > 90) {
      return res.status(400).json({
        success: false,
        message: 'Discount percentage must be between 1% and 90%'
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Check for overlapping offers (excluding current offer)
    if (product !== offer.product.toString() || 
        start.getTime() !== offer.startDate.getTime() || 
        end.getTime() !== offer.endDate.getTime()) {
      
      const hasOverlap = await ProductOffer.hasOverlappingOffer(product, start, end, id);
      if (hasOverlap) {
        return res.status(400).json({
          success: false,
          message: 'An active offer already exists for this product during the specified period'
        });
      }
    }

    // Update offer
    offer.product = product;
    offer.offerName = offerName.trim();
    offer.discountPercentage = discount;
    offer.startDate = start;
    offer.endDate = end;
    offer.description = description ? description.trim() : '';
    offer.isActive = isActive === 'true';

    await offer.save();

    res.status(200).json({
      success: true,
      message: 'Product offer updated successfully',
      offer
    });
  } catch (error) {
    console.error("Error updating product offer:", error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update product offer'
    });
  }
});

// Delete product offer
export const deleteProductOffer = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;

    const offer = await ProductOffer.findById(id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Product offer not found'
      });
    }

    await ProductOffer.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Product offer deleted successfully'
    });
  } catch (error) {
    console.error("Error deleting product offer:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete product offer'
    });
  }
});

// Toggle product offer status
export const toggleProductOfferStatus = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;

    const offer = await ProductOffer.findById(id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Product offer not found'
      });
    }

    offer.isActive = !offer.isActive;
    await offer.save();

    res.status(200).json({
      success: true,
      message: `Product offer ${offer.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: offer.isActive
    });
  } catch (error) {
    console.error("Error toggling product offer status:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update product offer status'
    });
  }
});

// Get product offer details
export const getProductOfferDetails = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;

    const offer = await ProductOffer.findById(id)
      .populate('product', 'productName price salePrice productImage category');

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Product offer not found'
      });
    }

    res.status(200).json({
      success: true,
      offer
    });
  } catch (error) {
    console.error("Error getting product offer details:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get product offer details'
    });
  }
});

// Check product availability for offers
export const checkProductAvailability = catchAsyncError(async (req, res, next) => {
  try {
    const { productId, startDate, endDate, excludeOfferId } = req.query;

    if (!productId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, start date, and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const hasOverlap = await ProductOffer.hasOverlappingOffer(
      productId, 
      start, 
      end, 
      excludeOfferId
    );

    res.status(200).json({
      success: true,
      available: !hasOverlap,
      message: hasOverlap ? 'Product has overlapping offer in this period' : 'Product is available for offer'
    });
  } catch (error) {
    console.error("Error checking product availability:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check product availability'
    });
  }
});