import { Order } from "../../model/orderModel.js";
import { User } from "../../model/userModel.js";
import { Product } from "../../model/productModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";

// Get admin orders dashboard
export const getAdminOrders = catchAsyncError(async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const search = req.query.search || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || 'orderDate';
    const sortOrder = req.query.sortOrder || 'desc';
    const returnStatus = req.query.returnStatus || '';
    
    // Build query
    let query = {};
    
    // Search functionality
    if (search) {
      query.$or = [
        { orderNumber: new RegExp(search, 'i') },
        { 'items.productName': new RegExp(search, 'i') }
      ];
    }
    
    // Status filter
    if (status) {
      query.orderStatus = status;
    }
    
    // Return status filter
    if (returnStatus) {
      query.returnStatus = returnStatus;
    }
    
    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Get orders with user population
    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.product', 'productName')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);
    
    // Get order statistics
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    // Get return requests count
    const returnRequests = await Order.countDocuments({ returnStatus: 'Requested' });
    
    res.render("admin/orders", {
      orders,
      currentPage: page,
      totalPages,
      totalOrders,
      limit,
      search,
      status,
      sortBy,
      sortOrder,
      returnStatus,
      orderStats,
      returnRequests,
      message: req.query.message || null,
      error: req.query.error || null
    });
    
  } catch (error) {
    console.error("Error loading admin orders:", error);
    return next(new ErrorHandler("Failed to load orders", 500));
  }
});

// Get order details for admin
export const getAdminOrderDetails = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId } = req.params;
    
    // Get order with full details
    const order = await Order.findById(orderId)
      .populate('user', 'name email phone')
      .populate('items.product', 'productName productImage category');
    
    if (!order) {
      return res.redirect('/admin/orders?error=Order not found');
    }
    
    res.render("admin/order-details", {
      order,
      message: req.query.message || null,
      error: req.query.error || null
    });
    
  } catch (error) {
    console.error("Error loading order details:", error);
    return res.redirect('/admin/orders?error=Failed to load order details');
  }
});

// Update order status
export const updateOrderStatus = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status'
      });
    }
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Update order status
    order.orderStatus = status;
    
    // Set delivery date if status is delivered
    if (status === 'Delivered') {
      order.deliveredAt = new Date();
      order.paymentStatus = 'Paid';
    }
    
    // Set cancellation date if status is cancelled
    if (status === 'Cancelled') {
      order.cancelledAt = new Date();
      
      // Restore stock for cancelled orders
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { quantity: item.quantity } }
        );
      }
    }
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      order: {
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        deliveredAt: order.deliveredAt
      }
    });
    
  } catch (error) {
    console.error("Error updating order status:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });
  }
});

// Handle return request approval/rejection
export const handleReturnRequest = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { action, adminNotes } = req.body; // action: 'approve' or 'reject'
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be approve or reject'
      });
    }
    
    const order = await Order.findById(orderId).populate('user');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    if (order.returnStatus !== 'Requested') {
      return res.status(400).json({
        success: false,
        message: 'No pending return request for this order'
      });
    }
    
    if (action === 'approve') {
      // Approve return request
      order.returnStatus = 'Approved';
      order.returnApprovedAt = new Date();
      order.adminReturnNotes = adminNotes || '';
      
      // Calculate refund amount
      let refundAmount = 0;
      for (const item of order.items) {
        const activeQuantity = item.quantity - item.cancelledQuantity - item.returnedQuantity;
        if (activeQuantity > 0) {
          const itemPrice = item.salePrice || item.price;
          refundAmount += itemPrice * activeQuantity;
          
          // Update returned quantity
          item.returnedQuantity += activeQuantity;
          item.itemStatus = 'Returned';
          
          // Restore stock
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { quantity: activeQuantity } }
          );
        }
      }
      
      // Add refund to user wallet (assuming wallet field exists in user model)
      if (order.user && refundAmount > 0) {
        await User.findByIdAndUpdate(
          order.user._id,
          { $inc: { wallet: refundAmount } }
        );
      }
      
      // Update order status if all items returned
      const allItemsReturned = order.items.every(item => 
        item.quantity === (item.cancelledQuantity + item.returnedQuantity)
      );
      
      if (allItemsReturned) {
        order.orderStatus = 'Returned';
        order.returnCompletedAt = new Date();
        order.returnStatus = 'Completed';
      }
      
      await order.save();
      
      res.status(200).json({
        success: true,
        message: 'Return request approved successfully',
        refundAmount: refundAmount
      });
      
    } else {
      // Reject return request
      order.returnStatus = 'Rejected';
      order.returnRejectedAt = new Date();
      order.adminReturnNotes = adminNotes || '';
      
      await order.save();
      
      res.status(200).json({
        success: true,
        message: 'Return request rejected'
      });
    }
    
  } catch (error) {
    console.error("Error handling return request:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process return request'
    });
  }
});

// Get return requests
export const getReturnRequests = catchAsyncError(async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    // Get orders with pending return requests
    const returnRequests = await Order.find({ returnStatus: 'Requested' })
      .populate('user', 'name email phone')
      .populate('items.product', 'productName')
      .sort({ returnRequestedAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalRequests = await Order.countDocuments({ returnStatus: 'Requested' });
    const totalPages = Math.ceil(totalRequests / limit);
    
    res.render("admin/return-requests", {
      returnRequests,
      currentPage: page,
      totalPages,
      totalRequests,
      message: req.query.message || null,
      error: req.query.error || null
    });
    
  } catch (error) {
    console.error("Error loading return requests:", error);
    return next(new ErrorHandler("Failed to load return requests", 500));
  }
});
