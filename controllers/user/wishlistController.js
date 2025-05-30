import { Wishlist } from "../../model/wishlistModel.js";
import { Product } from "../../model/productModel.js";
import { Category } from "../../model/categoryModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";

// Get wishlist page
export const getWishlist = catchAsyncError(async (req, res, next) => {
  try {
    const wishlist = await Wishlist.getOrCreateWishlist(req.user._id);
    
    // Validate wishlist items against current product status
    await validateWishlistItems(wishlist);
    
    res.render("user/wishlist", {
      wishlist,
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading wishlist:", error);
    return next(new ErrorHandler("Failed to load wishlist", 500));
  }
});

// Add product to wishlist
export const addToWishlist = catchAsyncError(async (req, res, next) => {
  try {
    const { productId } = req.body;
    
    // Validate product
    const product = await Product.findById(productId).populate('category');
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product or category is blocked/unlisted
    if (product.isBlocked || product.isDeleted || product.status !== "Available") {
      return res.status(400).json({
        success: false,
        message: 'This product is currently not available'
      });
    }

    if (!product.category.isListed) {
      return res.status(400).json({
        success: false,
        message: 'This product category is currently not available'
      });
    }

    // Get or create wishlist
    const wishlist = await Wishlist.getOrCreateWishlist(req.user._id);
    
    // Check if product is already in wishlist
    if (wishlist.hasProduct(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Product is already in your wishlist'
      });
    }

    // Add item to wishlist
    wishlist.addItem(productId);
    await wishlist.save();

    res.status(200).json({
      success: true,
      message: 'Product added to wishlist',
      wishlistCount: wishlist.totalItems
    });

  } catch (error) {
    console.error("Error adding to wishlist:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add item to wishlist'
    });
  }
});

// Remove item from wishlist
export const removeFromWishlist = catchAsyncError(async (req, res, next) => {
  try {
    const { productId } = req.params;
    
    // Get wishlist
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    // Remove item
    wishlist.removeItem(productId);
    await wishlist.save();

    res.status(200).json({
      success: true,
      message: 'Item removed from wishlist',
      wishlistCount: wishlist.totalItems
    });

  } catch (error) {
    console.error("Error removing from wishlist:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove item from wishlist'
    });
  }
});

// Clear entire wishlist
export const clearWishlist = catchAsyncError(async (req, res, next) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    wishlist.clearWishlist();
    await wishlist.save();

    res.status(200).json({
      success: true,
      message: 'Wishlist cleared successfully',
      wishlistCount: 0
    });

  } catch (error) {
    console.error("Error clearing wishlist:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear wishlist'
    });
  }
});

// Get wishlist count (for header display)
export const getWishlistCount = catchAsyncError(async (req, res, next) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    const wishlistCount = wishlist ? wishlist.totalItems : 0;

    res.status(200).json({
      success: true,
      wishlistCount
    });

  } catch (error) {
    console.error("Error getting wishlist count:", error);
    return res.status(500).json({
      success: false,
      wishlistCount: 0
    });
  }
});

// Move item from wishlist to cart
export const moveToCart = catchAsyncError(async (req, res, next) => {
  try {
    const { productId } = req.params;
    
    // This will be handled by the cart controller's addToCart function
    // which already removes items from wishlist when added to cart
    res.status(200).json({
      success: true,
      message: 'Use cart add endpoint to move item to cart'
    });

  } catch (error) {
    console.error("Error moving to cart:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to move item to cart'
    });
  }
});

// Validate wishlist items against current product status
async function validateWishlistItems(wishlist) {
  if (!wishlist.items || wishlist.items.length === 0) {
    return wishlist;
  }

  let hasChanges = false;
  const itemsToRemove = [];

  for (let i = 0; i < wishlist.items.length; i++) {
    const item = wishlist.items[i];
    const product = item.product;

    // Check if product is still available
    if (!product || product.isBlocked || product.isDeleted || product.status !== "Available") {
      itemsToRemove.push(item.product._id);
      hasChanges = true;
      continue;
    }

    // Check if category is still listed
    if (!product.category || !product.category.isListed) {
      itemsToRemove.push(item.product._id);
      hasChanges = true;
      continue;
    }
  }

  // Remove invalid items
  itemsToRemove.forEach(productId => {
    wishlist.removeItem(productId);
  });

  // Save changes if any
  if (hasChanges) {
    await wishlist.save();
  }

  return wishlist;
}
