import { Cart, CART_LIMITS } from "../../model/cartModel.js";
import { Wishlist } from "../../model/wishlistModel.js";
import { Product } from "../../model/productModel.js";
import { Category } from "../../model/categoryModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";

// Get cart page
export const getCart = catchAsyncError(async (req, res, next) => {
  try {
    const cart = await Cart.getOrCreateCart(req.user._id);
    
    // Validate cart items against current product status
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

// Add product to cart
export const addToCart = catchAsyncError(async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;
    
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

    // Check stock availability
    if (product.quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product is out of stock'
      });
    }

    // Get or create cart
    const cart = await Cart.getOrCreateCart(req.user._id);
    
    // Check if adding this quantity would exceed stock
    const existingItem = cart.getItem(productId);
    const currentQuantityInCart = existingItem ? existingItem.quantity : 0;
    const requestedQuantity = parseInt(quantity);
    const totalQuantity = currentQuantityInCart + requestedQuantity;

    if (totalQuantity > product.quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.quantity} items available. You already have ${currentQuantityInCart} in cart.`
      });
    }

    // Add item to cart
    cart.addItem(product, requestedQuantity);
    await cart.save();

    // Remove from wishlist if exists
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    if (wishlist && wishlist.hasProduct(productId)) {
      wishlist.removeItem(productId);
      await wishlist.save();
    }

    res.status(200).json({
      success: true,
      message: `${requestedQuantity} item(s) added to cart`,
      cartCount: cart.totalItems,
      cartTotal: cart.totalSalePrice
    });

  } catch (error) {
    console.error("Error adding to cart:", error);
    
    if (error.message.includes('Maximum') || error.message.includes('Only')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to add item to cart'
    });
  }
});

// Update cart item quantity
export const updateCartQuantity = catchAsyncError(async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    
    // Validate product and stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (quantity > product.quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.quantity} items available in stock`
      });
    }

    // Get cart
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    // Update quantity
    cart.updateItemQuantity(productId, parseInt(quantity));
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart updated successfully',
      cartCount: cart.totalItems,
      cartTotal: cart.totalSalePrice,
      itemTotal: quantity > 0 ? (product.salePrice || product.price) * quantity : 0
    });

  } catch (error) {
    console.error("Error updating cart quantity:", error);
    
    if (error.message.includes('Maximum') || error.message.includes('Only')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update cart'
    });
  }
});

// Remove item from cart
export const removeFromCart = catchAsyncError(async (req, res, next) => {
  try {
    const { productId } = req.params;
    
    // Get cart
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    // Remove item
    cart.removeItem(productId);
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      cartCount: cart.totalItems,
      cartTotal: cart.totalSalePrice
    });

  } catch (error) {
    console.error("Error removing from cart:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart'
    });
  }
});

// Clear entire cart
export const clearCart = catchAsyncError(async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.clearCart();
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      cartCount: 0,
      cartTotal: 0
    });

  } catch (error) {
    console.error("Error clearing cart:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear cart'
    });
  }
});

// Get cart count (for header display)
export const getCartCount = catchAsyncError(async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    const cartCount = cart ? cart.totalItems : 0;

    res.status(200).json({
      success: true,
      cartCount
    });

  } catch (error) {
    console.error("Error getting cart count:", error);
    return res.status(500).json({
      success: false,
      cartCount: 0
    });
  }
});

// Validate cart items against current product status
async function validateCartItems(cart) {
  if (!cart.items || cart.items.length === 0) {
    return cart;
  }

  let hasChanges = false;
  const itemsToRemove = [];

  for (let i = 0; i < cart.items.length; i++) {
    const item = cart.items[i];
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

    // Check if quantity exceeds available stock
    if (item.quantity > product.quantity) {
      if (product.quantity > 0) {
        // Reduce quantity to available stock
        item.quantity = product.quantity;
        hasChanges = true;
      } else {
        // Remove item if out of stock
        itemsToRemove.push(item.product._id);
        hasChanges = true;
      }
    }

    // Update prices if they have changed
    if (item.price !== product.price || item.salePrice !== product.salePrice) {
      item.price = product.price;
      item.salePrice = product.salePrice;
      hasChanges = true;
    }
  }

  // Remove invalid items
  itemsToRemove.forEach(productId => {
    cart.removeItem(productId);
  });

  // Save changes if any
  if (hasChanges) {
    await cart.save();
  }

  return cart;
}
