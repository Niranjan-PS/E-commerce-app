import { Cart, CART_LIMITS } from "../../model/cartModel.js";
import { Wishlist } from "../../model/wishlistModel.js";
import { Product } from "../../model/productModel.js";
import { Category } from "../../model/categoryModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";
import HttpStatus from "../../helpers/httpStatus.js";
import { calculateBestOfferPrice } from "../../utils/offerCalculator.js";


export const getCart = catchAsyncError(async (req, res, next) => {
  try {
    const cart = await Cart.getOrCreateCart(req.user._id);

   
    await validateCartItems(cart);

    res.render("user/cart", {
      cart,
      cartLimits: CART_LIMITS,
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading cart:", error);
    return next(new ErrorHandler("Failed to load cart", 500));
  }
});


export const addToCart = catchAsyncError(async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;

   
    const productData = await Product.findById(productId).populate('category');
    if (!productData) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Product not found'
      });
    }

   
    if (productData.isBlocked || productData.isDeleted || productData.status !== "Available") {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'This product is currently not available'
      });
    }

    if (!productData.category.isListed) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'This product category is currently not available'
      });
    }

    
    if (productData.quantity <= 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Product is out of stock'
      });
    }

    
    const cart = await Cart.getOrCreateCart(req.user._id);

   
    const existingItem = cart.getItem(productId);
    const currentQuantityInCart = existingItem ? existingItem.quantity : 0;
    const requestedQuantity = parseInt(quantity);
    const totalQuantity = currentQuantityInCart + requestedQuantity;

    if (totalQuantity > productData.quantity) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: `Only ${productData.quantity} items available. You already have ${currentQuantityInCart} in cart.`
      });
    }

   
    // Calculate offer price for the product
    const offerCalculation = await calculateBestOfferPrice(productData);
    
    cart.addItem(productData, requestedQuantity, offerCalculation);
    await cart.save();

    
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    if (wishlist && wishlist.hasProduct(productId)) {
      wishlist.removeItem(productId);
      await wishlist.save();
    }

    res.status(HttpStatus.OK).json({
      success: true,
      message: `${requestedQuantity} item(s) added to cart`,
      cartCount: cart.totalItems,
      cartTotal: cart.totalSalePrice
    });

  } catch (error) {
    console.error("Error adding to cart:", error);

    if (error.message.includes('Maximum') || error.message.includes('Only')) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: error.message
      });
    }

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to add item to cart'
    });
  }
});


export const updateCartQuantity = catchAsyncError(async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (quantity > product.quantity) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: `Only ${product.quantity} items available in stock`
      });
    }

    
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Cart not found'
      });
    }

    
    cart.updateItemQuantity(productId, parseInt(quantity));
    await cart.save();

   // Calculate offer price for updated quantity
    const offerCalculation = await calculateBestOfferPrice(product);
    const effectivePrice = offerCalculation.discountedPrice;

   res.status(HttpStatus.OK).json({
  success: true,
  message: 'Cart updated successfully',
  updatedSubtotal: quantity > 0 ? effectivePrice * quantity : 0,
  updatedGrandTotal: cart.totalSalePrice
});


  } catch (error) {
    console.error("Error updating cart quantity:", error);

    if (error.message.includes('Maximum') || error.message.includes('Only')) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: error.message
      });
    }

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update cart'
    });
  }
});


export const removeFromCart = catchAsyncError(async (req, res, next) => {
  try {
    const { productId } = req.params;

    
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Cart not found'
      });
    }

   
    cart.removeItem(productId);
    await cart.save();

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Item removed from cart',
      cartCount: cart.totalItems,
      cartTotal: cart.totalSalePrice
    });

  } catch (error) {
    console.error("Error removing from cart:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to remove item from cart'
    });
  }
});


export const clearCart = catchAsyncError(async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.clearCart();
    await cart.save();

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Cart cleared successfully',
      cartCount: 0,
      cartTotal: 0
    });

  } catch (error) {
    console.error("Error clearing cart:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to clear cart'
    });
  }
});


export const getCartCount = catchAsyncError(async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    const cartCount = cart ? cart.totalItems : 0;

    res.status(HttpStatus.OK).json({
      success: true,
      cartCount
    });

  } catch (error) {
    console.error("Error getting cart count:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      cartCount: 0
    });
  }
});


async function validateCartItems(cart) {
  if (!cart.items || cart.items.length === 0) {
    return cart;
  }

  let hasChanges = false;
  const itemsToRemove = [];

  for (let i = 0; i < cart.items.length; i++) {
    const item = cart.items[i];
    const product = item.product;

    
    if (!product || product.isBlocked || product.isDeleted || product.status !== "Available") {
      itemsToRemove.push(item.product._id);
      hasChanges = true;
      continue;
    }

    
    if (!product.category || !product.category.isListed) {
      itemsToRemove.push(item.product._id);
      hasChanges = true;
      continue;
    }

   
    if (item.quantity > product.quantity) {
      if (product.quantity > 0) {
        
        item.quantity = product.quantity;
        hasChanges = true;
      } else {
       
        itemsToRemove.push(item.product._id);
        hasChanges = true;
      }
    }

    // Recalculate offer prices
    const offerCalculation = await calculateBestOfferPrice(product);
    
    // Update prices and offer information
    if (item.price !== product.price || 
        item.salePrice !== product.salePrice ||
        item.originalPrice !== offerCalculation.originalPrice ||
        item.discountedPrice !== offerCalculation.discountedPrice) {
      
      item.price = product.price;
      item.salePrice = product.salePrice;
      item.originalPrice = offerCalculation.originalPrice;
      item.discountedPrice = offerCalculation.discountedPrice;
      item.offerSavings = offerCalculation.savings;
      item.hasOffer = offerCalculation.hasOffer;
      
      if (offerCalculation.offerDetails) {
        item.offerDetails = {
          id: offerCalculation.offerDetails.id,
          name: offerCalculation.offerDetails.name,
          discountPercentage: offerCalculation.offerDetails.discountPercentage,
          type: offerCalculation.offerDetails.type
        };
      } else {
        item.offerDetails = {};
      }
      
      // Store enhanced offer information
      item.appliedOfferInfo = offerCalculation.appliedOfferInfo;
      item.availableOffers = offerCalculation.availableOffers;
      
      hasChanges = true;
    }
  }

 
  itemsToRemove.forEach(productId => {
    cart.removeItem(productId);
  });

 
  if (hasChanges) {
    await cart.save();
  }

  return cart;
}
