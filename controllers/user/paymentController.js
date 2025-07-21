import Razorpay from 'razorpay';
import crypto from 'crypto';
import { Order } from "../../model/orderModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";
import { generateInvoiceAfterStatusChange } from './orderController.js';


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_ID,
  key_secret: process.env.RAZORPAY_SECRET_CODE,
});


export const createRazorpayOrder = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    
    if (order.paymentStatus === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Order is already paid'
      });
    }

    
    if (order.orderStatus === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot pay for cancelled order'
      });
    }

    
    if (order.paymentStatus === 'Failed' || order.paymentStatus === 'Pending') {
      order.paymentFailureReason = null;
      order.paymentStatus = 'Pending';
    }

    const razorpayOrderOptions = {
      amount: Math.round(order.totalAmount * 100), 
      currency: 'INR',
      receipt: `retry_${order.orderNumber}_${Date.now()}`,
      notes: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        userId: req.user._id.toString(),
        isRetry: order.razorpayOrderId ? 'true' : 'false',
        retryAttempt: Date.now().toString()
      }
    };

    const razorpayOrder = await razorpay.orders.create(razorpayOrderOptions);

    // Update order with new Razorpay order ID
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.status(200).json({
      success: true,
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt
      },
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount
      },
      user: {
        name: req.user.firstName + ' ' + req.user.lastName,
        email: req.user.email,
        phone: req.user.phone || ''
      },
      razorpayKeyId: process.env.RAZORPAY_ID
    });

  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create payment order'
    });
  }
});


export const verifyRazorpayPayment = catchAsyncError(async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification data'
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id,
      razorpayOrderId: razorpay_order_id
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or invalid'
      });
    }

    
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET_CODE)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      
      order.paymentStatus = 'Failed';
      order.razorpayPaymentId = razorpay_payment_id;
      order.paymentFailureReason = 'Signature verification failed';
      await order.save();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        redirectUrl: `/payment-failed/${order._id}`
      });
    }

    // Payment successful - update order
    order.paymentStatus = 'Paid';
    order.orderStatus = 'Confirmed';
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    order.paidAt = new Date();
    order.paymentFailureReason = null; 
    await order.save();

    
    try {
      const { clearCartAfterPayment } = await import('./checkoutController.js');
      await clearCartAfterPayment(req.user._id, order.items);
      console.log(`Cart cleared and stock updated for order: ${order.orderNumber}`);
    } catch (error) {
      console.error('Error clearing cart after payment:', error);
      
    }

   
    try {
      await generateInvoiceAfterStatusChange(order);
      console.log(`Invoice eligibility checked for order: ${order.orderNumber} after payment completion`);
    } catch (error) {
      console.error('Error checking invoice eligibility after payment:', error);
      return res.status(400).json({message:'couldnt complete payment'})
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      redirectUrl: `/payment-success/${order._id}`,
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus
      }
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Payment verification failed'
    });
  }
});


export const handlePaymentFailure = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId, error } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    
    order.paymentStatus = 'Failed';
    
    // Handle different types of payment failures
    if (error?.code === 'PAYMENT_CANCELLED') {
      order.paymentFailureReason = 'Payment cancelled by user';
    } else if (error?.description) {
      order.paymentFailureReason = error.description;
    } else if (error?.reason) {
      order.paymentFailureReason = error.reason;
    } else {
      order.paymentFailureReason = 'Payment failed';
    }

    await order.save();

    console.log(`Payment failed for order ${order.orderNumber}: ${order.paymentFailureReason}`);

    res.status(200).json({
      success: true,
      message: 'Payment failure recorded',
      paymentFailureReason: order.paymentFailureReason,
      redirectUrl: `/payment-failed/${order._id}`
    });

  } catch (error) {
    console.error('Error handling payment failure:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to handle payment failure'
    });
  }
});


export const getPaymentStatus = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: order.razorpayPaymentId,
      paymentFailureReason: order.paymentFailureReason
    });

  } catch (error) {
    console.error('Error getting payment status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get payment status'
    });
  }
}); 