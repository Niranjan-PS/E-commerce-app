import { Cart } from "../../model/cartModel.js";
import { Address } from "../../model/addressModel.js";
import { Product } from "../../model/productModel.js";
import { Order } from "../../model/orderModel.js";
import { Coupon } from "../../model/couponModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";
import { calculateBestOfferPrice } from "../../utils/offerCalculator.js";
import { getUserAvailableCoupons } from "../../services/referralService.js";


const TAX_CONFIG = {
  GST_RATE: 18, 
  SHIPPING_CHARGE: 50, 
  FREE_SHIPPING_THRESHOLD: 1000 
};


export const getCheckout = catchAsyncError(async (req, res, next) => {
  try {
    
    const cart = await Cart.getOrCreateCart(req.user._id);

    
    await validateCartItems(cart);

    if (!cart.items || cart.items.length === 0) {
      return res.redirect('/cart?error=Your cart is empty');
    }

    const hasOutOfStockItems = cart.items.some(item => {
      const product = item.product;
      return !product || product.quantity <= 0 || product.status !== 'Available' ||
             product.isBlocked || !product.category.isListed || item.quantity > product.quantity;
    });

    if (hasOutOfStockItems) {
      return res.redirect('/cart?error=Please remove out-of-stock items before checkout');
    }

    const addresses = await Address.getUserAddresses(req.user._id);
    const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0] || null;

    // Get user's available referral coupons
    const availableCoupons = await getUserAvailableCoupons(req.user._id);

    // Check if there's an applied coupon in session
    let couponDiscount = 0;
    let appliedCoupon = null;
    if (req.session.appliedCoupon) {
      couponDiscount = req.session.appliedCoupon.discount;
      appliedCoupon = {
        code: req.session.appliedCoupon.code,
        discount: couponDiscount
      };
    }

    const orderSummary = calculateOrderSummary(cart, couponDiscount);

    res.render("user/checkout", {
      cart,
      addresses,
      defaultAddress,
      orderSummary,
      appliedCoupon,
      availableCoupons,
      taxConfig: TAX_CONFIG,
      user: req.user,
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading checkout:", error);
    return next(new ErrorHandler("Failed to load checkout page", 500));
  }
});
function calculateOrderSummary(cart, couponDiscount = 0) {
  const subtotal = cart.totalSalePrice || 0;
  const savings = cart.totalSavings || 0;

  const tax = Math.round((subtotal * TAX_CONFIG.GST_RATE) / 100);

  const shipping = subtotal >= TAX_CONFIG.FREE_SHIPPING_THRESHOLD ? 0 : TAX_CONFIG.SHIPPING_CHARGE;

  const total = subtotal + tax + shipping - couponDiscount;

  return {
    subtotal,
    savings,
    couponDiscount,
    tax,
    shipping,
    total: Math.max(total, 0), 
    finalTotal: Math.max(total, 0),
    freeShippingThreshold: TAX_CONFIG.FREE_SHIPPING_THRESHOLD,
    taxRate: TAX_CONFIG.GST_RATE
  };
}

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

   
    const offerCalculation = await calculateBestOfferPrice(product);
    
    
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



export const applyCoupon = catchAsyncError(async (req, res, next) => {
  try {
    const { couponCode } = req.body;

    if (!couponCode || !couponCode.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a coupon code'
      });
    }

    
    const cart = await Cart.findOne({ user: req.user._id }).populate({
      path: 'items.product',
      populate: {
        path: 'category'
      }
    });

    if (!cart) {
      return res.status(400).json({
        success: false,
        message: 'Cart not found'
      });
    }

    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty'
      });
    }

   
    const invalidItems = cart.items.filter(item => !item.product || !item.product._id);
    if (invalidItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart contains invalid items. Please refresh and try again.'
      });
    }

    
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

    
    if (coupon.applicableCategories && coupon.applicableCategories.some(c => !c._id)) {
      return res.status(500).json({
        success: false,
        message: 'Coupon configuration error. Please contact support.'
      });
    }

    if (coupon.applicableProducts && coupon.applicableProducts.some(p => !p._id)) {
      return res.status(500).json({
        success: false,
        message: 'Coupon configuration error. Please contact support.'
      });
    }

    // Check if coupon is valid
    const now = new Date();

    if (!coupon.isValid()) {
      let message = 'This coupon is not valid';
      
      if (now < coupon.validFrom) {
        const timeDiff = coupon.validFrom.getTime() - now.getTime();
        const hoursDiff = Math.ceil(timeDiff / (1000 * 60 * 60));
        message = `This coupon will be active in ${hoursDiff} hours (from ${coupon.validFrom.toLocaleString()})`;
      } else if (now > coupon.validUntil) {
        message = `This coupon expired on ${coupon.validUntil.toLocaleString()}`;
      } else if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        message = 'This coupon has reached its usage limit';
      } else if (!coupon.isActive) {
        message = 'This coupon has been deactivated';
      }

      return res.status(400).json({
        success: false,
        message
      });
    }

   
    const hasUsedCoupon = coupon.usedBy.some(usage => 
      usage.user.toString() === req.user._id.toString()
    );

    if (hasUsedCoupon) {
      return res.status(400).json({
        success: false,
        message: 'You have already used this coupon'
      });
    }

    
    const cartTotal = cart.totalSalePrice || 0;

    if (cartTotal < coupon.minimumAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minimumAmount} required for this coupon`
      });
    }

    
    let isApplicable = false;
    
    if (coupon.applicableCategories.length === 0 && coupon.applicableProducts.length === 0) {
      
      isApplicable = true;
    } else {
      
      for (const item of cart.items) {
        const productId = item.product._id.toString();
        const categoryId = item.product.category ? item.product.category._id.toString() : null;
        
      
        let productMatch = false;
        if (coupon.applicableProducts && coupon.applicableProducts.length > 0) {
          productMatch = coupon.applicableProducts.some(p => {
            if (!p || !p._id) {
              return false;
            }
            return p._id.toString() === productId;
          });
        }
        
       
        let categoryMatch = false;
        if (categoryId && coupon.applicableCategories && coupon.applicableCategories.length > 0) {
          categoryMatch = coupon.applicableCategories.some(c => {
            if (!c || !c._id) {
              return false;
            }
            return c._id.toString() === categoryId;
          });
        }
        
        if (productMatch || categoryMatch) {
          isApplicable = true;
          break;
        }
      }
    }

    if (!isApplicable) {
      return res.status(400).json({
        success: false,
        message: 'This coupon is not applicable to items in your cart'
      });
    }

    const discount = coupon.calculateDiscount(cartTotal);
    
    if (discount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This coupon cannot be applied to your current order'
      });
    }

    
    req.session.appliedCoupon = {
      code: coupon.code,
      discount: discount,
      couponId: coupon._id
    };

   
    const orderSummary = calculateOrderSummary(cart, discount);

    res.status(200).json({
      success: true,
      message: `Coupon applied! You saved ₹${discount.toFixed(2)}`,
      orderSummary,
      couponDiscount: discount
    });

  } catch (error) {
    console.error("Error applying coupon:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to apply coupon'
    });
  }
});

// Apply referral coupon
export const applyReferralCoupon = catchAsyncError(async (req, res, next) => {
  try {
    const { couponId } = req.body;

    if (!couponId) {
      return res.status(400).json({
        success: false,
        message: 'Coupon ID is required'
      });
    }

    
    const cart = await Cart.getOrCreateCart(req.user._id);

    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty'
      });
    }

    
    const user = await req.user.constructor.findById(req.user._id).populate('assignedCoupons');
    const assignedCoupon = user.assignedCoupons.find(c => c._id.toString() === couponId);

    if (!assignedCoupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found in your account'
      });
    }

    // Check if coupon is valid
    if (!assignedCoupon.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'This coupon has expired or is no longer valid'
      });
    }

    // Check if user has already used this coupon
    const hasUsedCoupon = assignedCoupon.usedBy.some(usage => 
      usage.user.toString() === req.user._id.toString()
    );

    if (hasUsedCoupon) {
      return res.status(400).json({
        success: false,
        message: 'You have already used this coupon'
      });
    }

  
    const cartTotal = cart.totalSalePrice || 0;
    if (cartTotal < assignedCoupon.minimumAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${assignedCoupon.minimumAmount} required for this coupon`
      });
    }

    // Calculate discount
    const discount = assignedCoupon.calculateDiscount(cartTotal);
    
    if (discount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This coupon cannot be applied to your current order'
      });
    }

    
    req.session.appliedCoupon = {
      code: assignedCoupon.code,
      discount: discount,
      couponId: assignedCoupon._id,
      isReferralCoupon: true
    };

    
    const orderSummary = calculateOrderSummary(cart, discount);

    res.status(200).json({
      success: true,
      message: `Referral coupon applied! You saved ₹${discount.toFixed(2)}`,
      orderSummary,
      couponDiscount: discount
    });

  } catch (error) {
    console.error("Error applying referral coupon:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to apply coupon'
    });
  }
});

// Remove coupon
export const removeCoupon = catchAsyncError(async (req, res, next) => {
  try {
   
    if (req.session.appliedCoupon) {
      delete req.session.appliedCoupon;
    }

    
    const cart = await Cart.getOrCreateCart(req.user._id);
    
    
    const orderSummary = calculateOrderSummary(cart, 0);

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

export const placeOrder = catchAsyncError(async (req, res, next) => {
  try {
    const { addressId, paymentMethod, couponCode } = req.body;

    
    if (!addressId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Address and payment method are required'
      });
    }

    
    
    if (!['COD', 'Online', 'Wallet'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method'
      });
    }

     const OrderNotAllowed = await Order.aggregate([
       {
         $match: {
           paymentMethod: 'COD',
           totalAmount: { $gt: 1000 }
         }
       }
     ]);
     if(!OrderNotAllowed){
      return res.status(401).json({
        success:false,
        message: 'You Cannot order items above totalAmount 1000 on COD'
      })
     }
     
    

   
    const cart = await Cart.getOrCreateCart(req.user._id);

    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty'
      });
    }

    
    await validateCartItems(cart);

   
    const insufficientStockItems = [];
    for (const item of cart.items) {
      const product = await Product.findById(item.product._id);
      if (!product || product.quantity < item.quantity) {
        insufficientStockItems.push({
          name: item.product.productName,
          requested: item.quantity,
          available: product ? product.quantity : 0
        });
      }
    }
    if (insufficientStockItems.length > 0) {
      const names = insufficientStockItems.map(i => `${i.name} (requested: ${i.requested}, available: ${i.available})`).join(', ');
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for: ${names}. Please update your cart.`
      });
    }

    const address = await Address.findOne({ _id: addressId, user: req.user._id });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Shipping address not found'
      });
    }

   
    let couponDiscount = 0;
    let appliedCouponCode = null;
    let appliedCoupon = null;

    if (req.session.appliedCoupon) {
      appliedCouponCode = req.session.appliedCoupon.code;
      couponDiscount = req.session.appliedCoupon.discount;
      
      
      appliedCoupon = await Coupon.findById(req.session.appliedCoupon.couponId);
      if (!appliedCoupon || !appliedCoupon.isValid()) {
        return res.status(400).json({
          success: false,
          message: 'Applied coupon is no longer valid'
        });
      }

      
      const hasUsedCoupon = appliedCoupon.usedBy.some(usage => 
        usage.user.toString() === req.user._id.toString()
      );

      if (hasUsedCoupon) {
        return res.status(400).json({
          success: false,
          message: 'You have already used this coupon'
        });
      }
    }

    const orderSummary = calculateOrderSummary(cart, couponDiscount);
    
//Disallow COD if amount > 1000
if (paymentMethod === 'COD' && orderSummary.finalTotal > 1000) {
  return res.status(400).json({
    success: false,
    message: 'COD is not allowed for orders above ₹1000. Please choose Online Payment.'
  });
}

    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      productName: item.product.productName,
      productImage: item.product.productImage[0] || '',
      category: item.product.category.name,
      quantity: item.quantity,
      originalQuantity: item.quantity,
      price: item.price,
      salePrice: item.salePrice,
      originalPrice: item.originalPrice || item.price,
      discountedPrice: item.discountedPrice || item.price,
      offerSavings: item.offerSavings || 0,
      hasOffer: item.hasOffer || false,
      offerDetails: item.offerDetails || {},
      appliedOfferInfo: item.appliedOfferInfo || null,
      availableOffers: item.availableOffers || { productOffer: null, categoryOffer: null },
      discount: item.product.discount || 0,
      itemTotal: item.discountedPrice * item.quantity
    }));

    const orderNumber = Order.generateOrderNumber();
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
      subtotal: orderSummary.subtotal,
      productSavings: orderSummary.savings,
      couponDiscount: couponDiscount,
      couponCode: appliedCouponCode,
      tax: orderSummary.tax,
      taxRate: TAX_CONFIG.GST_RATE,
      shipping: orderSummary.shipping,
      totalAmount: orderSummary.finalTotal,
      paymentMethod: paymentMethod,
      paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Pending',
      orderStatus: paymentMethod === 'COD' ? 'Processing' : 'Pending Payment'
    });

    await order.save();

    
    if (appliedCoupon) {
      appliedCoupon.usedCount += 1;
      appliedCoupon.usedBy.push({
        user: req.user._id,
        usedAt: new Date()
      });
      await appliedCoupon.save();

      
      delete req.session.appliedCoupon;
    }

    for (const item of cart.items) {
      await Product.findByIdAndUpdate(
        item.product._id,
        { $inc: { quantity: -item.quantity } }
      );
    }



    cart.items = [];
    cart.calculateTotals();
    await cart.save();

   
    if (paymentMethod === 'COD') {
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
    } else if (paymentMethod === 'Wallet') {
      // Handle wallet payment
      const user = await req.user.constructor.findById(req.user._id);
      
      if (!user.wallet || user.wallet < orderSummary.finalTotal) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient wallet balance'
        });
      }

      // Deduct amount from wallet
      user.wallet -= orderSummary.finalTotal;
      await user.save();

      // Update order status
      order.paymentStatus = 'Paid';
      order.orderStatus = 'Confirmed';
      order.paidAt = new Date();
      await order.save();

      // Trigger invoice generation after successful wallet payment
      try {
        const { generateInvoiceAfterStatusChange } = await import('./orderController.js');
        await generateInvoiceAfterStatusChange(order);
        console.log(`Invoice eligibility checked for order: ${order.orderNumber} after wallet payment completion`);
      } catch (error) {
        console.error('Error checking invoice eligibility after wallet payment:', error);
        // Don't fail the order placement if invoice check fails
      }

      res.status(201).json({
        success: true,
        message: 'Order placed successfully using wallet',
        redirectUrl: `/order-success/${order._id}`,
        order: {
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          expectedDelivery: order.expectedDelivery
        }
      });
    } else {
      // Online payment
      res.status(201).json({
        success: true,
        message: 'Order created successfully. Proceed to payment.',
        requiresPayment: true,
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          expectedDelivery: order.expectedDelivery
        }
      });
    }

  } catch (error) {
    console.error("Error placing order:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to place order. Please try again.'
    });
  }
});

// Get all active coupons for modal
export const getActiveCoupons = catchAsyncError(async (req, res, next) => {
  try {
    const now = new Date();
    
    // Get all active coupons that are currently valid
    const coupons = await Coupon.find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $or: [
        { usageLimit: null },
        { $expr: { $lt: ['$usedCount', '$usageLimit'] } }
      ]
    })
    .populate('applicableCategories', 'name')
    .populate('applicableProducts', 'productName')
    .sort({ discountValue: -1 }); // Sort by discount value descending

    // Filter out coupons already used by this user
    const availableCoupons = coupons.filter(coupon => {
      const hasUsedCoupon = coupon.usedBy.some(usage => 
        usage.user.toString() === req.user._id.toString()
      );
      return !hasUsedCoupon;
    });

    res.status(200).json({
      success: true,
      coupons: availableCoupons
    });

  } catch (error) {
    console.error("Error fetching active coupons:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch coupons'
    });
  }
});

export const getOrderSuccess = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId } = req.params;

    
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