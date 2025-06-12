import { Cart } from "../../model/cartModel.js";
import { Address } from "../../model/addressModel.js";
import { Product } from "../../model/productModel.js";
import { Order } from "../../model/orderModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";


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
function calculateOrderSummary(cart) {
  const subtotal = cart.totalSalePrice || 0;
  const savings = cart.totalSavings || 0;

  const tax = Math.round((subtotal * TAX_CONFIG.GST_RATE) / 100);


  const shipping = subtotal >= TAX_CONFIG.FREE_SHIPPING_THRESHOLD ? 0 : TAX_CONFIG.SHIPPING_CHARGE;

  
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


    if (item.price !== product.price || item.salePrice !== product.salePrice) {
      item.price = product.price;
      item.salePrice = product.salePrice;
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


export const placeOrder = catchAsyncError(async (req, res, next) => {
  try {
    const { addressId, paymentMethod } = req.body;

    
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

    const address = await Address.findOne({ _id: addressId, user: req.user._id });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Shipping address not found'
      });
    }

    const orderSummary = calculateOrderSummary(cart);

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
      couponDiscount: 0,
      couponCode: null,
      tax: orderSummary.tax,
      taxRate: TAX_CONFIG.GST_RATE,
      shipping: orderSummary.shipping,
      totalAmount: orderSummary.total,
      paymentMethod: paymentMethod,
      paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid',
      orderStatus: 'Processing'
    });

    await order.save();

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