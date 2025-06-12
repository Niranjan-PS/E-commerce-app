import { Order } from "../../model/orderModel.js";
import { User } from "../../model/userModel.js";
import { Product } from "../../model/productModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";
import HttpStatus from "../../helpers/httpStatus.js";


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

    
    let query = {};

    
    if (search) {
      query.$or = [
        { orderNumber: new RegExp(search, 'i') },
        { 'items.productName': new RegExp(search, 'i') }
      ];
    }

   
    if (status) {
      query.orderStatus = status;
    }

    
    if (returnStatus) {
      query.returnStatus = returnStatus;
    }

    
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

   
    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.product', 'productName')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    
    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

   
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const fullOrderReturns = await Order.countDocuments({ returnStatus: 'Requested' });
    const individualItemReturns = await Order.countDocuments({ 'items.itemReturnStatus': 'Requested' });
    const returnRequests = fullOrderReturns + individualItemReturns;

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


export const getAdminOrderDetails = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId } = req.params;


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

// Update 
export const updateOrderStatus = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ['Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Invalid order status'
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Order not found'
      });
    }

   
    order.orderStatus = status;

   
    if (status === 'Delivered') {
      order.deliveredAt = new Date();
      order.paymentStatus = 'Paid';
    }

   
    if (status === 'Cancelled') {
      order.cancelledAt = new Date();

      
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { quantity: item.quantity } }
        );
      }
    }

    await order.save();

    res.status(HttpStatus.OK).json({
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
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update order status'
    });
  }
});


export const handleReturnRequest = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { action, adminNotes, items } = req.body; 

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
      order.returnStatus = 'Approved';
      order.returnApprovedAt = new Date();
      order.adminReturnNotes = adminNotes || '';

      
      let refundAmount = 0;

    
      if (items && items.length > 0) {
        for (const returnItem of items) {
          const orderItem = order.items.id(returnItem.itemId);
          if (!orderItem) continue;

          const activeQuantity = orderItem.quantity - orderItem.cancelledQuantity - orderItem.returnedQuantity;
          const returnQuantity = Math.min(returnItem.quantity || activeQuantity, activeQuantity);

          if (returnQuantity > 0) {
            const itemPrice = orderItem.salePrice || orderItem.price;
            refundAmount += itemPrice * returnQuantity;

            orderItem.returnedQuantity += returnQuantity;

           
            if (orderItem.returnedQuantity >= orderItem.quantity - orderItem.cancelledQuantity) {
              orderItem.itemStatus = 'Returned';
            } else {
              orderItem.itemStatus = 'Partially Returned';
            }

          
            await Product.findByIdAndUpdate(
              orderItem.product,
              { $inc: { quantity: returnQuantity } }
            );
          }
        }
      } else {
        // Process all eligible items (full return)
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
      }

      // Add refund to user wallet using the wallet controller
      if (order.user && refundAmount > 0) {
        const { addReturnAmountToWallet } = await import('../user/walletController.js');
        await addReturnAmountToWallet(order.user._id, refundAmount, order._id);
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


export const handleIndividualItemReturn = catchAsyncError(async (req, res, next) => {
  try {
    const { orderId, itemId } = req.params;
    const { action, adminNotes } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be approve or reject'
      });
    }

    const order = await Order.findById(orderId).populate('user').populate('items.product');

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

    if (orderItem.itemReturnStatus !== 'Requested') {
      return res.status(400).json({
        success: false,
        message: 'No pending return request for this item'
      });
    }

    if (action === 'approve') {

      orderItem.itemReturnStatus = 'Approved';
      orderItem.itemReturnApprovedAt = new Date();
      orderItem.adminItemReturnNotes = adminNotes || '';

      
      const availableQuantity = orderItem.quantity - orderItem.cancelledQuantity - orderItem.returnedQuantity;
      const itemPrice = orderItem.salePrice || orderItem.price;
      const refundAmount = itemPrice * availableQuantity;

      
      orderItem.returnedQuantity += availableQuantity;
      orderItem.itemStatus = 'Returned';
      orderItem.itemReturnStatus = 'Completed';
      orderItem.itemReturnCompletedAt = new Date();

      
      await Product.findByIdAndUpdate(
        orderItem.product._id,
        { $inc: { quantity: availableQuantity } }
      );

    
      const { Wallet } = await import('../../model/walletModel.js');
      let wallet = await Wallet.findOne({ userId: order.user._id });

      if (!wallet) {
        wallet = new Wallet({
          userId: order.user._id,
          balance: 0,
          transactions: []
        });
        await wallet.save();
        console.log(`New wallet created for user: ${order.user._id}`);
      }

      
      if (refundAmount > 0) {
        const { addReturnAmountToWallet } = await import('../user/walletController.js');
        await addReturnAmountToWallet(order.user._id, refundAmount, order._id);
      }

      await order.save();

      res.status(200).json({
        success: true,
        message: `Return request approved successfully for ${orderItem.productName}`,
        refundAmount: refundAmount,
        itemName: orderItem.productName
      });

    } else {
      orderItem.itemReturnStatus = 'Rejected';
      orderItem.itemReturnRejectedAt = new Date();
      orderItem.adminItemReturnNotes = adminNotes || '';

      await order.save();

      res.status(200).json({
        success: true,
        message: `Return request rejected for ${orderItem.productName}`,
        itemName: orderItem.productName
      });
    }

  } catch (error) {
    console.error("Error handling individual item return:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process individual item return request'
    });
  }
});


export const getReturnRequests = catchAsyncError(async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const search = req.query.search || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || 'returnRequestedAt';
    const sortOrder = req.query.sortOrder || 'desc';

   
    let query = {
      $or: [
        { returnStatus: 'Requested' }, 
        { 'items.itemReturnStatus': 'Requested' } 
      ]
    };

   
    if (search) {
      query.$and = [
        query,
        {
          $or: [
            { orderNumber: new RegExp(search, 'i') }
          ]
        }
      ];
    }

    
    let allReturnRequests = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.product', 'productName')
      .sort({ createdAt: -1 });

    
    let returnRequests = [];

    allReturnRequests.forEach(order => {
     
      if (order.returnStatus === 'Requested') {
        returnRequests.push({
          ...order.toObject(),
          returnType: 'full',
          returnRequestedAt: order.returnRequestedAt,
          returnReason: order.returnReason
        });
      }

      // Check for individual item returns
      order.items.forEach(item => {
        if (item.itemReturnStatus === 'Requested') {
          returnRequests.push({
            ...order.toObject(),
            returnType: 'individual',
            returnItem: item,
            returnRequestedAt: item.itemReturnRequestedAt,
            returnReason: item.itemReturnReason
          });
        }
      });
    });

    
    if (search) {
      returnRequests = returnRequests.filter(request =>
        request.user && (
          request.user.name.toLowerCase().includes(search.toLowerCase()) ||
          request.user.email.toLowerCase().includes(search.toLowerCase()) ||
          request.orderNumber.toLowerCase().includes(search.toLowerCase())
        )
      );
    }

    // Status filter
    if (status === 'urgent') {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      returnRequests = returnRequests.filter(request =>
        request.returnRequestedAt && new Date(request.returnRequestedAt) <= threeDaysAgo
      );
    } else if (status === 'recent') {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      returnRequests = returnRequests.filter(request =>
        request.returnRequestedAt && new Date(request.returnRequestedAt) > threeDaysAgo
      );
    }

   
    returnRequests.sort((a, b) => {
      const aDate = new Date(a.returnRequestedAt || a.createdAt);
      const bDate = new Date(b.returnRequestedAt || b.createdAt);
      return sortOrder === 'desc' ? bDate - aDate : aDate - bDate;
    });

    const totalRequests = returnRequests.length;
    const totalPages = Math.ceil(totalRequests / limit);

    
    returnRequests = returnRequests.slice(skip, skip + limit);

    res.render("admin/return-requests", {
      returnRequests,
      currentPage: page,
      totalPages,
      totalRequests,
      search,
      status,
      sortBy,
      sortOrder,
      message: req.query.message || null,
      error: req.query.error || null
    });

  } catch (error) {
    console.error("Error loading return requests:", error);
    return next(new ErrorHandler("Failed to load return requests", 500));
  }
});
