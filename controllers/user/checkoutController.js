import { Cart } from "../../model/cartModel.js";
import { Address } from "../../model/addressModel.js";
import { Product } from "../../model/productModel.js";
import { Coupon } from "../../model/couponModel.js";
import { Order } from "../../model/orderModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";

// Tax configuration
const TAX_CONFIG = {
  GST_RATE: 18, // 18% GST
  SHIPPING_CHARGE: 50, // Fixed shipping charge
  FREE_SHIPPING_THRESHOLD: 1000 // Free shipping above this amount
};

// Get checkout page
export const getCheckout = catchAsyncError(async (req, res, next) => {
  try {
    // Get user's cart
    const cart = await Cart.getOrCreateCart(req.user._id);

    // Validate cart items and check if cart is empty
    await validateCartItems(cart);

    if (!cart.items || cart.items.length === 0) {
      return res.redirect('/cart?error=Your cart is empty');
    }

    // Check for out-of-stock items
    const hasOutOfStockItems = cart.items.some(item => {
      const product = item.product;
      return !product || product.quantity <= 0 || product.status !== 'Available' ||
             product.isBlocked || !product.category.isListed || item.quantity > product.quantity;
    });

    if (hasOutOfStockItems) {
      return res.redirect('/cart?error=Please remove out-of-stock items before checkout');
    }

    // Get user's addresses
    const addresses = await Address.getUserAddresses(req.user._id);
    const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0] || null;

    // Calculate totals with tax
    const orderSummary = calculateOrderSummary(cart);

    res.render("user/checkout", {
      cart,
      addresses,
      defaultAddress,
      orderSummary,
      taxConfig: TAX_CONFIG,
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading checkout:", error);
    return next(new ErrorHandler("Failed to load checkout page", 500));
  }
});

// Apply coupon
export const applyCoupon = catchAsyncError(async (req, res, next) => {
  try {
    const { couponCode } = req.body;

    if (!couponCode) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required'
      });
    }

    // Get user's cart
    const cart = await Cart.getOrCreateCart(req.user._id);

    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Find coupon
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true
    }).populate('applicableCategories applicableProducts');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }

    // Validate coupon
    if (!coupon.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Coupon has expired or reached usage limit'
      });
    }

    // Check if user has already used this coupon
    const hasUsedCoupon = coupon.usedBy.some(usage =>
      usage.user.toString() === req.user._id.toString()
    );

    if (hasUsedCoupon) {
      return res.status(400).json({
        success: false,
        message: 'You have already used this coupon'
      });
    }

    // Calculate order summary
    const orderSummary = calculateOrderSummary(cart);

    // Check minimum amount
    if (orderSummary.subtotal < coupon.minimumAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minimumAmount} required`
      });
    }

    // Calculate coupon discount
    const couponDiscount = calculateCouponDiscount(coupon, cart, orderSummary.subtotal);

    if (couponDiscount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This coupon is not applicable to your cart items'
      });
    }

    // Recalculate totals with coupon
    const finalOrderSummary = {
      ...orderSummary,
      couponDiscount,
      couponCode: coupon.code,
      finalTotal: Math.max(0, orderSummary.total - couponDiscount)
    };

    res.status(200).json({
      success: true,
      message: 'Coupon applied successfully',
      orderSummary: finalOrderSummary,
      couponDiscount
    });

  } catch (error) {
    console.error("Error applying coupon:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to apply coupon'
    });
  }
});

// Remove coupon
export const removeCoupon = catchAsyncError(async (req, res, next) => {
  try {
    // Get user's cart
    const cart = await Cart.getOrCreateCart(req.user._id);

    // Recalculate totals without coupon
    const orderSummary = calculateOrderSummary(cart);

    res.status(200).json({
      success: true,
      message: 'Coupon removed successfully',
      orderSummary
    });

  } catch (error) {
    console.error("Error removing coupon:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove coupon'
    });
  }
});

// Calculate order summary with tax and shipping
function calculateOrderSummary(cart) {
  const subtotal = cart.totalSalePrice || 0;
  const savings = cart.totalSavings || 0;

  // Calculate tax (GST)
  const tax = Math.round((subtotal * TAX_CONFIG.GST_RATE) / 100);

  // Calculate shipping
  const shipping = subtotal >= TAX_CONFIG.FREE_SHIPPING_THRESHOLD ? 0 : TAX_CONFIG.SHIPPING_CHARGE;

  // Calculate total
  const total = subtotal + tax + shipping;

  return {
    subtotal,
    savings,
    tax,
    shipping,
    total,
    freeShippingThreshold: TAX_CONFIG.FREE_SHIPPING_THRESHOLD,
    taxRate: TAX_CONFIG.GST_RATE
  };
}

// Calculate coupon discount
function calculateCouponDiscount(coupon, cart, subtotal) {
  let applicableAmount = 0;

  // Check if coupon applies to specific products or categories
  if (coupon.applicableProducts.length > 0 || coupon.applicableCategories.length > 0) {
    // Calculate applicable amount based on specific products/categories
    cart.items.forEach(item => {
      const product = item.product;
      const itemTotal = (product.salePrice || product.price) * item.quantity;

      // Check if product is directly applicable
      const isProductApplicable = coupon.applicableProducts.some(
        p => p._id.toString() === product._id.toString()
      );

      // Check if product's category is applicable
      const isCategoryApplicable = coupon.applicableCategories.some(
        c => c._id.toString() === product.category._id.toString()
      );

      if (isProductApplicable || isCategoryApplicable) {
        applicableAmount += itemTotal;
      }
    });
  } else {
    // Coupon applies to entire cart
    applicableAmount = subtotal;
  }

  if (applicableAmount <= 0) {
    return 0;
  }

  let discount = 0;
  if (coupon.discountType === 'percentage') {
    discount = Math.round((applicableAmount * coupon.discountValue) / 100);

    // Apply maximum discount limit if set
    if (coupon.maximumDiscount && discount > coupon.maximumDiscount) {
      discount = coupon.maximumDiscount;
    }
  } else {
    // Fixed discount
    discount = Math.min(coupon.discountValue, applicableAmount);
  }

  return discount;
}

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

// Place order with COD
export const placeOrder = catchAsyncError(async (req, res, next) => {
  try {
    const { addressId, paymentMethod, couponCode, orderSummary } = req.body;

    // Validate required fields
    if (!addressId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Address and payment method are required'
      });
    }

    // Currently only support COD
    if (paymentMethod !== 'COD') {
      return res.status(400).json({
        success: false,
        message: 'Currently only Cash on Delivery is supported'
      });
    }

    // Get user's cart
    const cart = await Cart.getOrCreateCart(req.user._id);

    // Validate cart
    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty'
      });
    }

    // Validate cart items and stock
    await validateCartItems(cart);

    // Check for out-of-stock items
    const hasOutOfStockItems = cart.items.some(item => {
      const product = item.product;
      return !product || product.quantity <= 0 || product.status !== 'Available' ||
             product.isBlocked || !product.category.isListed || item.quantity > product.quantity;
    });

    if (hasOutOfStockItems) {
      return res.status(400).json({
        success: false,
        message: 'Some items in your cart are out of stock. Please update your cart.'
      });
    }

    // Get shipping address
    const address = await Address.findOne({ _id: addressId, user: req.user._id });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Shipping address not found'
      });
    }

    // Calculate order totals
    let finalOrderSummary = calculateOrderSummary(cart);
    let appliedCoupon = null;

    // Apply coupon if provided
    if (couponCode) {
      appliedCoupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true
      });

      if (appliedCoupon && appliedCoupon.isValid()) {
        const couponDiscount = calculateCouponDiscount(appliedCoupon, cart, finalOrderSummary.subtotal);
        if (couponDiscount > 0) {
          finalOrderSummary.couponDiscount = couponDiscount;
          finalOrderSummary.couponCode = couponCode.toUpperCase();
          finalOrderSummary.finalTotal = Math.max(0, finalOrderSummary.total - couponDiscount);
        }
      }
    }

    // Create order items
    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      productName: item.product.productName,
      productImage: item.product.productImage[0] || '',
      category: item.product.category.name,
      quantity: item.quantity,
      originalQuantity: item.quantity,
      price: item.price,
      salePrice: item.salePrice,
      discount: item.product.discount || 0,
      itemTotal: (item.salePrice || item.price) * item.quantity
    }));

    // Generate unique order number
    const orderNumber = Order.generateOrderNumber();

    // Create order
    const order = new Order({
      user: req.user._id,
      orderNumber: orderNumber,
      items: orderItems,
      shippingAddress: {
        fullName: address.fullName,
        phone: address.phone,
        street: address.street,
        landmark: address.landmark || '',
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        addressType: address.addressType
      },
      subtotal: finalOrderSummary.subtotal,
      productSavings: finalOrderSummary.savings,
      couponDiscount: finalOrderSummary.couponDiscount || 0,
      couponCode: finalOrderSummary.couponCode || null,
      tax: finalOrderSummary.tax,
      taxRate: TAX_CONFIG.GST_RATE,
      shipping: finalOrderSummary.shipping,
      totalAmount: finalOrderSummary.finalTotal || finalOrderSummary.total,
      paymentMethod: paymentMethod,
      paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid',
      orderStatus: 'Pending'
    });

    // Save order
    await order.save();

    // Update product quantities
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(
        item.product._id,
        { $inc: { quantity: -item.quantity } }
      );
    }

    // Update coupon usage if applied
    if (appliedCoupon && finalOrderSummary.couponDiscount > 0) {
      appliedCoupon.usedCount += 1;
      appliedCoupon.usedBy.push({
        user: req.user._id,
        orderNumber: order.orderNumber,
        discountAmount: finalOrderSummary.couponDiscount,
        usedAt: new Date()
      });
      await appliedCoupon.save();
    }

    // Clear cart
    cart.items = [];
    cart.calculateTotals();
    await cart.save();

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      redirectUrl: `/order-success/${order._id}`,
      order: {
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        expectedDelivery: order.expectedDelivery
      }
    });

  } catch (error) {
    console.error("Error placing order:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to place order. Please try again.'
    });
  }
});

// Get order success page
export const getOrderSuccess = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId } = req.params;

    // Get order details
    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id
    }).populate('items.product');

    if (!order) {
      return res.redirect('/');
    }

    res.render("user/order-success", {
      order,
      message: req.query.message || null,
      error: req.query.error || null
    });

  } catch (error) {
    console.error("Error loading order success page:", error);
    return res.redirect('/');
  }
});