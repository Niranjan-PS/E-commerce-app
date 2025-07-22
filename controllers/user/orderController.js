import { Order } from "../../model/orderModel.js";
import { Product } from "../../model/productModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";
import PDFDocument from 'pdfkit';
import { Address } from "../../model/addressModel.js";
import { updateStockOnOrder } from "../admin/inventoryController.js";
import { addReturnAmountToWallet } from './walletController.js'; 


const checkInvoiceEligibility = (order) => {
  
  if (order.paymentStatus === 'Pending') {
    return {
      eligible: false,
      reason: 'Invoice cannot be generated while payment is pending. Please complete the payment first.'
    };
  }

 
  if (order.paymentStatus === 'Failed') {
    return {
      eligible: false,
      reason: 'Invoice cannot be generated for failed payments. Please retry payment or contact support.'
    };
  }

  
  if (order.paymentMethod === 'Online') {
    if (order.paymentStatus !== 'Paid') {
      return {
        eligible: false,
        reason: 'Invoice can only be generated after payment completion for online orders'
      };
    }
  }
  
  
  if (order.paymentMethod === 'COD') {
    if (order.orderStatus !== 'Delivered') {
      return {
        eligible: false,
        reason: 'Invoice can only be generated after delivery for COD orders'
      };
    }
    
    if (order.paymentStatus !== 'Paid') {
      return {
        eligible: false,
        reason: 'Invoice can only be generated after payment is confirmed for COD orders'
      };
    }
  }

  
  if (order.paymentMethod === 'Wallet') {
    if (order.paymentStatus !== 'Paid') {
      return {
        eligible: false,
        reason: 'Invoice can only be generated after payment completion for wallet orders'
      };
    }
  }

  
  if (order.orderStatus === 'Cancelled') {
    return {
      eligible: false,
      reason: 'Invoice cannot be generated for cancelled orders'
    };
  }

 
  if (order.paymentStatus !== 'Paid') {
    return {
      eligible: false,
      reason: 'Invoice can only be generated when payment status is "Paid"'
    };
  }

  return {
    eligible: true,
    reason: null
  };
};

const generateInvoiceAfterStatusChange = async (order) => {
  try {
    const canGenerate = checkInvoiceEligibility(order);
    if (canGenerate.eligible) {
      
      console.log(`Invoice is now available for order: ${order.orderNumber}`);
      
     
      if (!order.invoiceGenerated) {
        order.invoiceGenerated = true;
        order.invoiceGeneratedAt = new Date();
        await order.save();
        console.log(`Invoice generation marked for order: ${order.orderNumber}`);
      }
      
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error checking invoice eligibility:', error);
    return false;
  }
};

export const getOrderDetails = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId } = req.params;

   
    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id
    }).populate('items.product');

    if (!order) {
      return res.redirect('/?error=Order not found');
    }

    
    const canBeCancelled = order.canBeCancelled();
    const canRequestReturn = order.canRequestReturn();

    const orderObj = order.toObject();
    orderObj.canBeCancelled = canBeCancelled;
    orderObj.canRequestReturn = canRequestReturn;
    
    
    const invoiceEligibility = checkInvoiceEligibility(order);
    orderObj.canGenerateInvoice = invoiceEligibility.eligible;
    orderObj.invoiceMessage = invoiceEligibility.reason;
    
    const displayAddress= order.shippingAddress
    if(!displayAddress){
      return res.status(400).json({"message":"addres not found"})
    }

    res.render("user/order-details", {
      order: orderObj,
      displayAddress,
      message: req.query.message || null,
      error: req.query.error || null
    });

  } catch (error) {
    console.error("Error loading order details:", error);
    return res.redirect('/?error=Failed to load order details');
  }
});

// Get user orders list
export const getUserOrders = catchAsyncError(async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';

    let orders;
    let totalOrders;

    if (search) {
      orders = await Order.searchOrders(req.user._id, search, { page, limit });
      totalOrders = await Order.countDocuments({
        user: req.user._id,
        $or: [
          { orderNumber: new RegExp(search, 'i') },
          { 'items.productName': new RegExp(search, 'i') }
        ]
      });
    } else {
      
      let query = { user: req.user._id };
      if (status) {
        query.orderStatus = status;
      }

      orders = await Order.find(query)
        .populate('items.product')
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(limit);

      totalOrders = await Order.countDocuments(query);
    }

    const totalPages = Math.ceil(totalOrders / limit);

    
    const ordersWithEligibility = orders.map(order => {
      const canBeCancelled = order.canBeCancelled();
      const canRequestReturn = order.canRequestReturn();
      const invoiceEligibility = checkInvoiceEligibility(order);

      const orderObj = order.toObject();
      orderObj.canBeCancelled = canBeCancelled;
      orderObj.canRequestReturn = canRequestReturn;
      orderObj.canGenerateInvoice = invoiceEligibility.eligible;
      return orderObj;
    });

    res.render("user/orders", {
      orders: ordersWithEligibility,
      currentPage: page,
      totalPages,
      totalOrders,
      search,
      status,
      message: req.query.message || null,
      error: req.query.error || null
    });

  } catch (error) {
    console.error("Error loading orders:", error);
    return next(new ErrorHandler("Failed to load orders", 500));
  }
});


export const cancelOrder = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason, items } = req.body; 

    
    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id
    }).populate('items.product');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    
    const orderCreatedAt = new Date(order.orderDate || order.createdAt);
    const currentTime = new Date();
    const timeDifference = currentTime.getTime() - orderCreatedAt.getTime();
    const hoursDifference = timeDifference / (1000 * 60 * 60); 

    if (hoursDifference > 24) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel the product — Cancellation period has expired.'
      });
    }

    
    if (!order.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
    }

    let isFullCancellation = true;
    let totalRefundAmount = 0;

    
    const itemsToCancel = items && items.length > 0 ? items : order.items.map(item => ({
      productId: item.product._id.toString(),
      quantity: item.quantity - item.cancelledQuantity
    }));

    
    for (const cancelItem of itemsToCancel) {
      const orderItem = order.items.find(item =>
        item.product._id.toString() === cancelItem.productId
      );

      if (!orderItem) {
        continue;
      }

      const cancelQuantity = Math.min(
        cancelItem.quantity,
        orderItem.quantity - orderItem.cancelledQuantity
      );

      if (cancelQuantity > 0) {
        
        orderItem.cancelledQuantity += cancelQuantity;

        
        if (orderItem.cancelledQuantity >= orderItem.quantity) {
          orderItem.itemStatus = 'Cancelled';
        } else {
          orderItem.itemStatus = 'Partially Cancelled';
          isFullCancellation = false;
        }

        const itemPrice = orderItem.discountedPrice || orderItem.salePrice || orderItem.price;
        // Calculate proportional tax for this item
        const itemTax = (itemPrice * cancelQuantity * order.taxRate) / 100;
        const itemRefundWithTax = (itemPrice * cancelQuantity) + itemTax;
        totalRefundAmount += itemRefundWithTax;

        await Product.findByIdAndUpdate(
          orderItem.product._id,
          { $inc: { quantity: cancelQuantity } }
        );
      }

      if (orderItem.quantity > orderItem.cancelledQuantity) {
        isFullCancellation = false;
      }
    }

    const allItemsInactive = order.items.every(item =>
      item.quantity === (item.cancelledQuantity + item.returnedQuantity)
    );

    if (allItemsInactive) {
      order.orderStatus = 'Cancelled';
      order.cancelledAt = new Date();
    }

    order.cancellationReason = reason;
    await order.save();

    
    let walletRefundAmount = 0;
    if (allItemsInactive && order.paymentMethod === 'Online' && order.paymentStatus === 'Paid') {
      
      walletRefundAmount = order.totalAmount;
      await addReturnAmountToWallet(
        req.user._id,
        walletRefundAmount,
        order._id 
      );
    } else if (!allItemsInactive && order.paymentMethod === 'Online' && order.paymentStatus === 'Paid') {
     
      walletRefundAmount = totalRefundAmount;
      if (walletRefundAmount > 0) {
        await addReturnAmountToWallet(
          req.user._id,
          walletRefundAmount,
          order._id 
        );
      }
    }

    res.status(200).json({
      success: true,
      message: allItemsInactive ? 'Order cancelled successfully' : 'Items cancelled successfully',
      refundAmount: totalRefundAmount,
      walletRefundAmount: walletRefundAmount,
      isFullCancellation: allItemsInactive,
      refundNote: walletRefundAmount > 0 ? `₹${walletRefundAmount} has been credited to your wallet` : null
    });

  } catch (error) {
    console.error("Error cancelling order:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel order'
    });
  }
});

// Request return order 
export const returnOrder = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason, items } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Return reason is required'
      });
    }

    
    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id
    }).populate('items.product');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    //return duration-7days deadline
    if (!order.deliveredAt || (Date.now() - order.deliveredAt.getTime()) > (7 * 24 * 60 * 60 * 1000)) {
      return res.status(400).json({
        success: false,
        message: 'Return window closed. You can only return items within 7 days of delivery.'
      });
    }

    if (!order.canRequestReturn()) {
      let message = 'Return request cannot be submitted.';

      if (order.orderStatus !== 'Delivered') {
        message = 'Returns can only be requested for delivered orders.';
      } else if (!order.deliveredAt) {
        message = 'Order delivery date not found.';
      } else if ((Date.now() - order.deliveredAt.getTime()) > (7 * 24 * 60 * 60 * 1000)) {
        message = 'Return window closed. You can only return items within 7 days of delivery.';
      } else if (order.returnStatus === 'Requested') {
        message = 'Return request is already pending admin approval.';
      } else if (order.returnStatus === 'Approved') {
        message = 'Return has already been approved.';
      } else if (order.returnStatus === 'Completed') {
        message = 'Return has already been completed.';
      }

      return res.status(400).json({
        success: false,
        message: message
      });
    }

    
    const itemsToReturn = items && items.length > 0 ? items : order.items.map(item => ({
      productId: item.product._id.toString(),
      quantity: item.quantity - item.cancelledQuantity - item.returnedQuantity
    })).filter(item => item.quantity > 0);

   
    let totalRefundAmount = 0;
    let hasValidItems = false;

    for (const returnItem of itemsToReturn) {
      const orderItem = order.items.find(item =>
        item.product._id.toString() === returnItem.productId
      );

      if (!orderItem) {
        continue;
      }

      const availableQuantity = orderItem.quantity - orderItem.cancelledQuantity - orderItem.returnedQuantity;
      const returnQuantity = Math.min(returnItem.quantity, availableQuantity);

      if (returnQuantity > 0) {
        hasValidItems = true;
        const itemPrice = orderItem.discountedPrice || orderItem.salePrice || orderItem.price;
        
        const itemTax = (itemPrice * returnQuantity * order.taxRate) / 100;
        const itemRefundWithTax = (itemPrice * returnQuantity) + itemTax;
        totalRefundAmount += itemRefundWithTax;
      }
    }

    if (!hasValidItems) {
      return res.status(400).json({
        success: false,
        message: 'No eligible items found for return'
      });
    }

    order.returnReason = reason.trim();
    order.returnStatus = 'Requested';
    order.returnRequestedAt = new Date();
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Return request submitted successfully. Your request is pending admin approval.',
      estimatedRefundAmount: totalRefundAmount,
      returnStatus: 'Requested'
    });

  } catch (error) {
    console.error("Error processing return:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process return request'
    });
  }
});

// download invoice PDF -
export const downloadInvoice = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId } = req.params;

    
    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id
    }).populate('items.product').populate('user');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

   
    const canGenerateInvoice = checkInvoiceEligibility(order);
    
    if (!canGenerateInvoice.eligible) {
      return res.status(400).json({
        success: false,
        message: canGenerateInvoice.reason
      });
    }

    
    const doc = new PDFDocument({ margin: 50 });

   
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderNumber}.pdf`);

   
    doc.pipe(res);

   
    doc.fontSize(20).text('LUXE SCENTS', 50, 50);
    doc.fontSize(10).text('Premium Fragrances & Perfumes', 50, 75);
    doc.text('Email: info@luxescents.com | Phone: +91 9876543210', 50, 90);

    
    doc.fontSize(16).text('INVOICE', 400, 50);
    doc.fontSize(10).text(`Invoice #: ${order.orderNumber}`, 400, 75);
    doc.text(`Date: ${new Date(order.orderDate).toLocaleDateString()}`, 400, 90);

   
    doc.moveTo(50, 120).lineTo(550, 120).stroke();

    
    doc.fontSize(12).text('Bill To:', 50, 140);
    doc.fontSize(10).text(order.shippingAddress.fullName, 50, 160);
    doc.text(order.shippingAddress.street, 50, 175);
    if (order.shippingAddress.landmark) {
      doc.text(order.shippingAddress.landmark, 50, 190);
    }
    doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state}`, 50, 205);
    doc.text(order.shippingAddress.zipCode, 50, 220);
    doc.text(`Phone: ${order.shippingAddress.phone}`, 50, 235);

  
    doc.fontSize(12).text('Order Details:', 300, 140);
    doc.fontSize(10).text(`Order Status: ${order.orderStatus}`, 300, 160);
    doc.text(`Payment Method: ${order.paymentMethod}`, 300, 175);
    doc.text(`Payment Status: ${order.paymentStatus}`, 300, 190);
    if (order.deliveredAt) {
      doc.text(`Delivered: ${new Date(order.deliveredAt).toLocaleDateString()}`, 300, 205);
    }

   
    let yPosition = 280;
    doc.fontSize(10);
    doc.text('Item', 50, yPosition);
    doc.text('Qty', 300, yPosition);
    doc.text('Price', 350, yPosition);
    doc.text('Total', 450, yPosition);

   
    yPosition += 15;
    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
    yPosition += 10;

   
    order.items.forEach(item => {
     
      const itemPrice = item.discountedPrice || item.salePrice || item.price;
      const itemTotal = itemPrice * item.quantity;

      doc.text(item.productName, 50, yPosition, { width: 240 });
      doc.text(item.quantity.toString(), 300, yPosition);
      doc.text(`₹${itemPrice.toFixed(2)}`, 350, yPosition);
      doc.text(`₹${itemTotal.toFixed(2)}`, 450, yPosition);
      yPosition += 20;
    });

    
    yPosition += 20;
    doc.moveTo(300, yPosition).lineTo(550, yPosition).stroke();
    yPosition += 15;

    doc.text('Subtotal:', 350, yPosition);
    doc.text(`₹${order.subtotal.toFixed(2)}`, 450, yPosition);
    yPosition += 15;

    if (order.productSavings > 0) {
      doc.text('Product Savings:', 350, yPosition);
      doc.text(`-₹${order.productSavings.toFixed(2)}`, 450, yPosition);
      yPosition += 15;
    }

    if (order.couponDiscount > 0) {
      doc.text(`Coupon (${order.couponCode}):`, 350, yPosition);
      doc.text(`-₹${order.couponDiscount.toFixed(2)}`, 450, yPosition);
      yPosition += 15;
    }

    doc.text('Tax (GST):',  350, yPosition);
    doc.text(`₹${order.tax.toFixed(2)}`, 450, yPosition);
    yPosition += 15;

    doc.text('Shipping:', 350, yPosition);
    doc.text(order.shipping > 0 ? `₹${order.shipping.toFixed(2)}` : 'FREE', 450, yPosition);
    yPosition += 15;

    // Add final total
    doc.moveTo(300, yPosition).lineTo(550, yPosition).stroke();
    yPosition += 15;
    doc.fontSize(12).text('Total Amount:', 350, yPosition);
    doc.text(`₹${order.totalAmount.toFixed(2)}`, 450, yPosition);

    // Add footer
    yPosition += 50;
    doc.fontSize(8).text('Thank you for shopping with Luxe Scents!', 50, yPosition);
    doc.text('For any queries, contact us at support@luxescents.com', 50, yPosition + 15);

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error("Error generating invoice:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate invoice'
    });
  }
});


export const markOrderDelivered = catchAsyncError(async (req, res, next) => {
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

    
    order.orderStatus = 'Delivered';
    order.deliveredAt = new Date();
    order.paymentStatus = 'Paid';
    await order.save();

   
    await generateInvoiceAfterStatusChange(order);

    res.status(200).json({
      success: true,
      message: 'Order marked as delivered successfully'
    });

  } catch (error) {
    console.error("Error marking order as delivered:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark order as delivered'
    });
  }
});


export const cancelOrderItem = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason, quantity } = req.body;

    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id
    }).populate('items.product');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    
    if (!order.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
    }

  
    const orderItem = order.items.id(itemId);
    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in order'
      });
    }

    const availableQuantity = orderItem.quantity - orderItem.cancelledQuantity;
    const cancelQuantity = quantity ? Math.min(quantity, availableQuantity) : availableQuantity;

    if (cancelQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No quantity available to cancel for this item'
      });
    }

    
    orderItem.cancelledQuantity += cancelQuantity;
    if (orderItem.cancelledQuantity >= orderItem.quantity) {
      orderItem.itemStatus = 'Cancelled';
    } else {
      orderItem.itemStatus = 'Partially Cancelled';
    }

    const itemPrice = orderItem.discountedPrice || orderItem.salePrice || orderItem.price;
     const refundAmount = itemPrice * cancelQuantity;

  
    await Product.findByIdAndUpdate(
      orderItem.product._id,
      { $inc: { quantity: cancelQuantity } }
    );

    
    const allItemsInactive = order.items.every(item =>
      item.quantity === (item.cancelledQuantity + item.returnedQuantity)
    );

    
    if (allItemsInactive) {
      order.orderStatus = 'Cancelled';
      order.cancelledAt = new Date();
    }

    if (reason) {
      order.cancellationReason = reason;
    }

    await order.save();

    
    

    res.status(200).json({
      success: true,
      message: `${cancelQuantity} item(s) cancelled successfully`,
     
      cancelledQuantity: cancelQuantity,
      itemStatus: orderItem.itemStatus
    });

  } catch (error) {
    console.error("Error cancelling item:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel item'
    });
  }
});


export const returnOrderItem = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason, quantity } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Return reason is required'
      });
    }

   
    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id
    }).populate('items.product');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    
   
    if (!order.deliveredAt || (Date.now() - order.deliveredAt.getTime()) > (7 * 24 * 60 * 60 * 1000)) {
      return res.status(400).json({
        success: false,
        message: 'Return window closed. You can only return items within 7 days of delivery.'
      });
    }

    if (!order.canRequestReturn()) {
      let message = 'Return request cannot be submitted.';

      if (order.orderStatus !== 'Delivered') {
        message = 'Returns can only be requested for delivered orders.';
      } else if (!order.deliveredAt) {
        message = 'Order delivery date not found.';
      } else if ((Date.now() - order.deliveredAt.getTime()) > (7 * 24 * 60 * 60 * 1000)) {
        message = 'Return window closed. You can only return items within 7 days of delivery.';
      }

      return res.status(400).json({
        success: false,
        message: message
      });
    }

    const orderItem = order.items.id(itemId);
    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in order'
      });
    }

    const availableQuantity = orderItem.quantity - orderItem.cancelledQuantity - orderItem.returnedQuantity;
    const returnQuantity = quantity ? Math.min(quantity, availableQuantity) : availableQuantity;

    if (returnQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No quantity available to return for this item'
      });
    }

  
    const itemPrice = orderItem.discountedPrice || orderItem.salePrice || orderItem.price;
    const estimatedRefund = itemPrice * returnQuantity;

    
    if (order.returnStatus === 'None') {
      order.returnReason = reason.trim();
      order.returnStatus = 'Requested';
      order.returnRequestedAt = new Date();
      await order.save();
    }

    res.status(200).json({
      success: true,
      message: 'Return request submitted successfully for the item. Your request is pending admin approval.',
      estimatedRefundAmount: estimatedRefund,
      returnQuantity: returnQuantity,
      itemName: orderItem.productName
    });

  } catch (error) {
    console.error("Error processing item return:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process return request'
    });
  }
});


export const requestIndividualItemReturn = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason, quantity } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Return reason is required'
      });
    }

    
    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id
    }).populate('items.product');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

   
    const orderItem = order.items.id(itemId);
    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in order'
      });
    }

    
     
    if (!order.deliveredAt || (Date.now() - order.deliveredAt.getTime()) > (7 * 24 * 60 * 60 * 1000)) {
      return res.status(400).json({
        success: false,
        message: 'Return window closed. You can only return items within 7 days of delivery.'
      });
    }

    if (!order.canItemRequestReturn(itemId)) {
      let message = 'Return request cannot be submitted for this item.';

      if (order.orderStatus !== 'Delivered') {
        message = 'Returns can only be requested for delivered orders.';
      } else if (!order.deliveredAt) {
        message = 'Order delivery date not found.';
      } else if ((Date.now() - order.deliveredAt.getTime()) > (7 * 24 * 60 * 60 * 1000)) {
        message = 'Return window closed. You can only return items within 7 days of delivery.';
      } else if (orderItem.itemReturnStatus === 'Requested') {
        message = 'Return request is already pending for this item.';
      } else if (orderItem.itemReturnStatus === 'Approved') {
        message = 'Return has already been approved for this item.';
      } else if (orderItem.itemReturnStatus === 'Completed') {
        message = 'Return has already been completed for this item.';
      }

      return res.status(400).json({
        success: false,
        message: message
      });
    }

    const availableQuantity = order.getItemReturnableQuantity(itemId);
    const returnQuantity = quantity ? Math.min(quantity, availableQuantity) : availableQuantity;

    if (returnQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No quantity available to return for this item'
      });
    }

    
    const itemPrice = orderItem.discountedPrice || orderItem.salePrice || orderItem.price;
    const estimatedRefund = itemPrice * returnQuantity;

   
    orderItem.itemReturnStatus = 'Requested';
    orderItem.itemReturnReason = reason.trim();
    orderItem.itemReturnRequestedAt = new Date();

    await order.save();

    res.status(200).json({
      success: true,
      message: `Return request submitted successfully for ${orderItem.productName}. Your request is pending admin approval.`,
      estimatedRefundAmount: estimatedRefund,
      returnQuantity: returnQuantity,
      itemName: orderItem.productName
    });

  } catch (error) {
    console.error("Error processing individual item return:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process return request'
    });
  }
});

export const completeReturnAndCreditWallet = catchAsyncError(async (req, res, next) => {
    const { orderId } = req.params;

    
    const order = await Order.findOne({
        _id: orderId,
        
    }).populate('items.product');

    if (!order) {
        return res.status(404).json({
            success: false,
            message: 'Order not found  please contact support team'
        });
    }

    
    if (order.returnStatus !== 'Approved' && order.returnStatus !== 'Requested') {
        return res.status(400).json({
            success: false,
            message: 'Return is not approved or already completed'
        });
    }

   
    let totalRefundAmount = 0;
    for (const item of order.items) {
        const activeQuantity = item.quantity - item.cancelledQuantity - item.returnedQuantity;
        if (activeQuantity > 0) {
            const itemPrice = item.discountedPrice || item.salePrice || item.price;
            // Calculate proportional tax for this item
            const itemTax = (itemPrice * activeQuantity * order.taxRate) / 100;
            const itemRefundWithTax = (itemPrice * activeQuantity) + itemTax;
            totalRefundAmount += itemRefundWithTax;
        }
    }

   
    order.returnStatus = 'Completed';
    order.returnCompletedAt = new Date();
    await order.save();

   
    await addReturnAmountToWallet(order.user, totalRefundAmount, order._id);

    res.status(200).json({
        success: true,
        message: 'Return completed and wallet credited',
        refundAmount: totalRefundAmount
    });
});


export { checkInvoiceEligibility, generateInvoiceAfterStatusChange };