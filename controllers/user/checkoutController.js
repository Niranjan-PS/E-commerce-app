import { Cart } from "../../model/cartModel.js";
import { Address } from "../../model/addressModel.js";
import { Product } from "../../model/productModel.js";
import { Order } from "../../model/orderModel.js";
import { Coupon } from "../../model/couponModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";
import { calculateBestOfferPrice } from "../../utils/offerCalculator.js";


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
      taxConfig: TAX_CONFIG,
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
    total: Math.max(total, 0), // Ensure total is never negative
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


// Apply coupon
export const applyCoupon = catchAsyncError(async (req, res, next) => {
  try {
     console.log('=== COUPON APPLICATION DEBUG ===');
    console.log('Request body:', req.body);
    console.log('User ID:', req.user._id);

    const { couponCode } = req.body;

    if (!couponCode || !couponCode.trim()) {
      console.log('ERROR: No coupon code provided');
      return res.status(400).json({
        success: false,
        message: 'Please enter a coupon code'
      });
    }

    // Get user's cart with proper population
    const cart = await Cart.findOne({ user: req.user._id }).populate({
      path: 'items.product',
      populate: {
        path: 'category'
      }
    });

    if (!cart) {
      console.log('ERROR: Cart not found for user');
      return res.status(400).json({
        success: false,
        message: 'Cart not found'
      });
    }
    console.log('Cart found:', {
      itemCount: cart.items.length,
      totalSalePrice: cart.totalSalePrice
    });

    if (!cart.items || cart.items.length === 0) {
      console.log('ERROR: Cart is empty');
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty'
      });
    }

    // Validate cart items are properly populated
    const invalidItems = cart.items.filter(item => !item.product || !item.product._id);
    if (invalidItems.length > 0) {
      console.log('ERROR: Cart contains items with invalid product references');
      return res.status(400).json({
        success: false,
        message: 'Cart contains invalid items. Please refresh and try again.'
      });
    }

    // Log cart items for debugging
    console.log('Cart items:', cart.items.map(item => ({
      productId: item.product._id,
      productName: item.product.productName,
      categoryId: item.product.category ? item.product.category._id : 'NO_CATEGORY',
      categoryName: item.product.category ? item.product.category.name : 'NO_CATEGORY'
    })));

    // Find coupon
    const coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase(),
      isActive: true 
    }).populate('applicableCategories applicableProducts');

    console.log('Coupon lookup result:', {
      found: !!coupon,
      code: coupon ? coupon.code : 'NOT_FOUND'
    });

    if (!coupon) {
      console.log('ERROR: Coupon not found');
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }

    // Validate coupon population
    if (coupon.applicableCategories && coupon.applicableCategories.some(c => !c._id)) {
      console.log('ERROR: Coupon has invalid category references');
      return res.status(500).json({
        success: false,
        message: 'Coupon configuration error. Please contact support.'
      });
    }

    if (coupon.applicableProducts && coupon.applicableProducts.some(p => !p._id)) {
      console.log('ERROR: Coupon has invalid product references');
      return res.status(500).json({
        success: false,
        message: 'Coupon configuration error. Please contact support.'
      });
    }

    console.log('Coupon details:', {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minimumAmount: coupon.minimumAmount,
      applicableCategoriesCount: coupon.applicableCategories.length,
      applicableProductsCount: coupon.applicableProducts.length,
      applicableCategories: coupon.applicableCategories.map(c => ({ id: c._id, name: c.name })),
      applicableProducts: coupon.applicableProducts.map(p => ({ id: p._id, name: p.productName }))
    });

    // Check if coupon is valid
    const now = new Date();
    console.log('Coupon validity check:', {
      currentTime: now.toISOString(),
      validFrom: coupon.validFrom.toISOString(),
      validUntil: coupon.validUntil.toISOString(),
      isActive: coupon.isActive,
      usageLimit: coupon.usageLimit,
      usedCount: coupon.usedCount
    });

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

      console.log('ERROR: Coupon not valid -', message);
      return res.status(400).json({
        success: false,
        message,
        debug: {
          currentTime: now.toISOString(),
          validFrom: coupon.validFrom.toISOString(),
          validUntil: coupon.validUntil.toISOString(),
          isActive: coupon.isActive
        }
      });
    }

    // Check if user has already used this coupon
    const hasUsedCoupon = coupon.usedBy.some(usage => 
      usage.user.toString() === req.user._id.toString()
    );

    if (hasUsedCoupon) {
      console.log('ERROR: User has already used this coupon');
      return res.status(400).json({
        success: false,
        message: 'You have already used this coupon'
      });
    }

    // Check minimum amount
    const cartTotal = cart.totalSalePrice || 0;
    console.log('Cart total check:', { cartTotal, minimumRequired: coupon.minimumAmount });

    if (cartTotal < coupon.minimumAmount) {
      console.log('ERROR: Cart total below minimum amount');
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minimumAmount} required for this coupon`
      });
    }

    // Check if coupon is applicable to cart items
    let isApplicable = false;
    let applicabilityDetails = [];
    
    if (coupon.applicableCategories.length === 0 && coupon.applicableProducts.length === 0) {
      // Coupon applies to all products
      isApplicable = true;
      console.log('Coupon applies to ALL products');
    } else {
      console.log('Checking product/category specific applicability...');
      
      // Check if any cart item matches coupon criteria
      for (const item of cart.items) {
        const productId = item.product._id.toString();
        const categoryId = item.product.category ? item.product.category._id.toString() : null;
        
        console.log(`Checking item: ${item.product.productName} (ID: ${productId}, Category: ${categoryId})`);
        
        // Check if product is directly applicable
        let productMatch = false;
        if (coupon.applicableProducts && coupon.applicableProducts.length > 0) {
          productMatch = coupon.applicableProducts.some(p => {
            if (!p || !p._id) {
              console.log('  Warning: Invalid product in coupon.applicableProducts');
              return false;
            }
            const match = p._id.toString() === productId;
            console.log(`  Product match check: ${p._id.toString()} === ${productId} = ${match}`);
            return match;
          });
        }
        
        // Check if category is applicable
        let categoryMatch = false;
        if (categoryId && coupon.applicableCategories && coupon.applicableCategories.length > 0) {
          categoryMatch = coupon.applicableCategories.some(c => {
            if (!c || !c._id) {
              console.log('  Warning: Invalid category in coupon.applicableCategories');
              return false;
            }
            const match = c._id.toString() === categoryId;
            console.log(`  Category match check: ${c._id.toString()} === ${categoryId} = ${match}`);
            return match;
          });
        } else if (!categoryId) {
          console.log('  Product has no category, skipping category check');
        }
        
        applicabilityDetails.push({
          productName: item.product.productName,
          productId,
          categoryId,
          productMatch,
          categoryMatch,
          applicable: productMatch || categoryMatch
        });
        
        if (productMatch || categoryMatch) {
          isApplicable = true;
          console.log(`✓ Item ${item.product.productName} is applicable`);
          break;
        } else {
          console.log(`✗ Item ${item.product.productName} is NOT applicable`);
        }
      }
    }

    console.log('Applicability check result:', { isApplicable, applicabilityDetails });

    if (!isApplicable) {
      console.log('ERROR: Coupon not applicable to any cart items');
      return res.status(400).json({
        success: false,
        message: 'This coupon is not applicable to items in your cart',
        debug: {
          cartItems: applicabilityDetails,
          couponCategories: coupon.applicableCategories.map(c => c.name),
          couponProducts: coupon.applicableProducts.map(p => p.productName)
        }
      });
    }

    // Calculate discount
    const discount = coupon.calculateDiscount(cartTotal);
    console.log('Discount calculation:', { cartTotal, discount });
    
    if (discount <= 0) {
      console.log('ERROR: Discount calculation resulted in 0 or negative');
      return res.status(400).json({
        success: false,
        message: 'This coupon cannot be applied to your current order'
      });
    }

    // Store coupon in session
    req.session.appliedCoupon = {
      code: coupon.code,
      discount: discount,
      couponId: coupon._id
    };

    console.log('Coupon applied successfully:', { code: coupon.code, discount });

    // Calculate updated order summary
    const orderSummary = calculateOrderSummary(cart, discount);

    console.log('=== END COUPON APPLICATION DEBUG ===');

    res.status(200).json({
      success: true,
      message: `Coupon applied! You saved ₹${discount.toFixed(2)}`,
      orderSummary,
      couponDiscount: discount
    });

  } catch (error) {
    console.error("Error applying coupon:", error);
    console.error("Stack trace:", error.stack);
    return res.status(500).json({
      success: false,
      message: 'Failed to apply coupon',
      error: error.message
    });
  }
});

// Remove coupon
export const removeCoupon = catchAsyncError(async (req, res, next) => {
  try {
    // Remove coupon from session
    if (req.session.appliedCoupon) {
      delete req.session.appliedCoupon;
    }

    // Get user's cart
    const cart = await Cart.getOrCreateCart(req.user._id);
    
    // Calculate order summary without coupon
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

    
    if (paymentMethod !== 'COD') {
      return res.status(400).json({
        success: false,
        message: 'Currently only Cash on Delivery is supported'
      });
    }

   
    const cart = await Cart.getOrCreateCart(req.user._id);

    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty'
      });
    }

    
    await validateCartItems(cart);

    // Strict stock validation: re-fetch latest stock for each product
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

    // Handle coupon if applied
    let couponDiscount = 0;
    let appliedCouponCode = null;
    let appliedCoupon = null;

    if (req.session.appliedCoupon) {
      appliedCouponCode = req.session.appliedCoupon.code;
      couponDiscount = req.session.appliedCoupon.discount;
      
      // Verify coupon is still valid
      appliedCoupon = await Coupon.findById(req.session.appliedCoupon.couponId);
      if (!appliedCoupon || !appliedCoupon.isValid()) {
        return res.status(400).json({
          success: false,
          message: 'Applied coupon is no longer valid'
        });
      }

      // Check if user has already used this coupon
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

    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      productName: item.product.productName,
      productImage: item.product.productImage[0] || '',
      category: item.product.category.name,
      quantity: item.quantity,
      originalQuantity: item.quantity,
      price: item.price,
      salePrice: item.salePrice,
      // Include offer-related fields
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
      paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid',
      orderStatus: 'Processing'
    });

    await order.save();

    // Update coupon usage if applied
    if (appliedCoupon) {
      appliedCoupon.usedCount += 1;
      appliedCoupon.usedBy.push({
        user: req.user._id,
        usedAt: new Date()
      });
      await appliedCoupon.save();

      // Clear coupon from session
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