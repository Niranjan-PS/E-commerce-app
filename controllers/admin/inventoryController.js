import { Product } from "../../model/productModel.js";
import { Category } from "../../model/categoryModel.js";
import { Order } from "../../model/orderModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";

// Get inventory dashboard
export const getInventoryDashboard = catchAsyncError(async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const search = req.query.search || '';
    const category = req.query.category || '';
    const stockStatus = req.query.stockStatus || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';

    // Build query
    let query = { isDeleted: false };

    // Search functionality
    if (search) {
      query.$or = [
        { productName: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { brand: new RegExp(search, 'i') }
      ];
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Stock status filter with null handling
    if (stockStatus === 'low') {
      query.$or = [
        { quantity: { $lte: 10, $gt: 0 } },
        { quantity: null },
        { quantity: { $exists: false } }
      ];
    } else if (stockStatus === 'out') {
      query.$or = [
        { quantity: 0 },
        { quantity: null },
        { quantity: { $exists: false } }
      ];
    } else if (stockStatus === 'available') {
      query.quantity = { $gt: 0 };
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get products with category population
    const products = await Product.find(query)
      .populate('category', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    // Get categories for filter
    const categories = await Category.find({ isListed: true });

    // Get inventory statistics with null value handling
    const inventoryStats = await Product.aggregate([
      { $match: { isDeleted: false } },
      {
        $addFields: {
          // Handle null/undefined values by setting defaults
          safeQuantity: { $ifNull: ['$quantity', 0] },
          safeSalePrice: { $ifNull: ['$salePrice', 0] },
          safeRegularPrice: { $ifNull: ['$regularPrice', 0] }
        }
      },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStock: { $sum: '$safeQuantity' },
          lowStockCount: {
            $sum: {
              $cond: [{ $and: [{ $lte: ['$safeQuantity', 10] }, { $gt: ['$safeQuantity', 0] }] }, 1, 0]
            }
          },
          outOfStockCount: {
            $sum: {
              $cond: [{ $eq: ['$safeQuantity', 0] }, 1, 0]
            }
          },
          totalValue: {
            $sum: {
              $multiply: [
                '$safeQuantity',
                { $cond: [{ $gt: ['$safeSalePrice', 0] }, '$safeSalePrice', '$safeRegularPrice'] }
              ]
            }
          }
        }
      }
    ]);

    const stats = inventoryStats[0] || {
      totalProducts: 0,
      totalStock: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      totalValue: 0
    };

    res.render("admin/inventory", {
      products,
      categories,
      currentPage: page,
      totalPages,
      totalProducts,
      limit,
      search,
      category,
      stockStatus,
      sortBy,
      sortOrder,
      stats,
      message: req.query.message || null,
      error: req.query.error || null
    });

  } catch (error) {
    console.error("Error loading inventory:", error);
    return next(new ErrorHandler("Failed to load inventory", 500));
  }
});

// Update stock quantity
export const updateStock = catchAsyncError(async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity, action } = req.body; // action: 'set', 'add', 'subtract'

    if (quantity === undefined || quantity === null || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quantity value'
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Handle null/undefined current quantity
    const currentQuantity = product.quantity || 0;
    const inputQuantity = parseInt(quantity) || 0;
    let newQuantity;
    let previousQuantity = currentQuantity;

    switch (action) {
      case 'set':
        newQuantity = inputQuantity;
        break;
      case 'add':
        newQuantity = currentQuantity + inputQuantity;
        break;
      case 'subtract':
        newQuantity = Math.max(0, currentQuantity - inputQuantity);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action'
        });
    }

    // Update product quantity
    product.quantity = newQuantity;
    await product.save();

    res.status(200).json({
      success: true,
      message: `Stock updated successfully. New quantity: ${newQuantity}`,
      product: {
        _id: product._id,
        productName: product.productName || 'Unknown Product',
        quantity: product.quantity,
        previousQuantity: previousQuantity
      }
    });

  } catch (error) {
    console.error("Error updating stock:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update stock'
    });
  }
});

// Bulk stock update
export const bulkUpdateStock = catchAsyncError(async (req, res, next) => {
  try {
    const { updates } = req.body; // Array of { productId, quantity, action }

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const { productId, quantity, action } = update;

        if (quantity === undefined || quantity === null || quantity < 0) {
          errors.push(`Invalid quantity for product ${productId}`);
          continue;
        }

        const product = await Product.findById(productId);
        if (!product) {
          errors.push(`Product ${productId} not found`);
          continue;
        }

        // Handle null/undefined current quantity
        const currentQuantity = product.quantity || 0;
        const inputQuantity = parseInt(quantity) || 0;
        let newQuantity;

        switch (action) {
          case 'set':
            newQuantity = inputQuantity;
            break;
          case 'add':
            newQuantity = currentQuantity + inputQuantity;
            break;
          case 'subtract':
            newQuantity = Math.max(0, currentQuantity - inputQuantity);
            break;
          default:
            errors.push(`Invalid action for product ${product.productName || productId}`);
            continue;
        }

        product.quantity = newQuantity;
        await product.save();

        results.push({
          productId: product._id,
          productName: product.productName || 'Unknown Product',
          newQuantity: newQuantity,
          previousQuantity: currentQuantity,
          action: action
        });

      } catch (error) {
        errors.push(`Error updating ${update.productId}: ${error.message}`);
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk update completed. ${results.length} products updated.`,
      results: results,
      errors: errors
    });

  } catch (error) {
    console.error("Error in bulk stock update:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to perform bulk update'
    });
  }
});

// Get low stock alerts
export const getLowStockAlerts = catchAsyncError(async (req, res, next) => {
  try {
    const lowStockThreshold = 10;

    // Get products with low stock (handling null quantities)
    const lowStockProducts = await Product.find({
      isDeleted: false,
      $or: [
        { quantity: { $lte: lowStockThreshold, $gt: 0 } },
        { quantity: null },
        { quantity: { $exists: false } }
      ]
    })
    .populate('category', 'name')
    .sort({ quantity: 1 });

    // Get out of stock products (including null quantities)
    const outOfStockProducts = await Product.find({
      isDeleted: false,
      $or: [
        { quantity: 0 },
        { quantity: null },
        { quantity: { $exists: false } }
      ]
    })
    .populate('category', 'name')
    .sort({ productName: 1 });

    // Filter and clean the data
    const cleanLowStockProducts = lowStockProducts.map(product => ({
      ...product.toObject(),
      quantity: product.quantity || 0,
      categoryName: product.category?.name || 'Uncategorized',
      salePrice: product.salePrice || product.regularPrice || 0
    }));

    const cleanOutOfStockProducts = outOfStockProducts.map(product => ({
      ...product.toObject(),
      quantity: product.quantity || 0,
      categoryName: product.category?.name || 'Uncategorized',
      salePrice: product.salePrice || product.regularPrice || 0
    }));

    res.render("admin/stock-alerts", {
      lowStockProducts: cleanLowStockProducts,
      outOfStockProducts: cleanOutOfStockProducts,
      lowStockThreshold,
      message: req.query.message || null,
      error: req.query.error || null
    });

  } catch (error) {
    console.error("Error loading stock alerts:", error);
    return next(new ErrorHandler("Failed to load stock alerts", 500));
  }
});

// Get stock movement history
export const getStockMovements = catchAsyncError(async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const search = req.query.search || '';
    const movementType = req.query.movementType || '';

    // Build query for stock movements
    let query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { orderNumber: new RegExp(search, 'i') },
        { 'items.productName': new RegExp(search, 'i') }
      ];
    }

    // Movement type filter
    if (movementType === 'placed') {
      query.orderStatus = { $in: ['Pending', 'Processing', 'Shipped', 'Delivered'] };
    } else if (movementType === 'cancelled') {
      query.orderStatus = 'Cancelled';
    } else if (movementType === 'returned') {
      query.returnStatus = 'Approved';
    }

    // Get recent orders that affected stock with null handling
    const stockMovements = await Order.find(query)
      .populate('user', 'name email')
      .populate('items.product', 'productName quantity')
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(limit);

    const totalMovements = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalMovements / limit);

    // Clean and enhance movement data
    const cleanStockMovements = stockMovements.map(order => ({
      ...order.toObject(),
      user: {
        name: order.user?.name || 'Unknown User',
        email: order.user?.email || 'No Email'
      },
      items: order.items.map(item => ({
        ...item,
        productName: item.product?.productName || item.productName || 'Unknown Product',
        quantity: item.quantity || 0,
        currentStock: item.product?.quantity || 0
      })),
      movementType: order.orderStatus === 'Cancelled' ? 'Stock Restored (Cancelled)' :
                   order.returnStatus === 'Approved' ? 'Stock Restored (Returned)' :
                   'Stock Reduced (Order Placed)'
    }));

    res.render("admin/stock-movements", {
      stockMovements: cleanStockMovements,
      currentPage: page,
      totalPages,
      totalMovements,
      search,
      movementType,
      message: req.query.message || null,
      error: req.query.error || null
    });

  } catch (error) {
    console.error("Error loading stock movements:", error);
    return next(new ErrorHandler("Failed to load stock movements", 500));
  }
});

// Auto-update stock based on order actions
export const updateStockOnOrder = async (orderId, action) => {
  try {
    const order = await Order.findById(orderId).populate('items.product');

    if (!order) {
      throw new Error('Order not found');
    }

    for (const item of order.items) {
      const product = await Product.findById(item.product._id);

      if (!product) {
        console.error(`Product ${item.product._id} not found`);
        continue;
      }

      // Handle null/undefined quantities
      const currentQuantity = product.quantity || 0;
      const itemQuantity = item.quantity || 0;

      switch (action) {
        case 'place':
          // Decrease stock when order is placed
          product.quantity = Math.max(0, currentQuantity - itemQuantity);
          break;

        case 'cancel':
          // Restore stock when order is cancelled
          product.quantity = currentQuantity + itemQuantity;
          break;

        case 'return':
          // Restore stock when order is returned
          const returnedQuantity = item.returnedQuantity || itemQuantity;
          product.quantity = currentQuantity + returnedQuantity;
          break;

        default:
          console.error(`Unknown stock action: ${action}`);
          continue;
      }

      await product.save();
      console.log(`Stock updated for ${product.productName}: ${currentQuantity} → ${product.quantity} (${action})`);
    }

    return { success: true, message: 'Stock updated successfully' };

  } catch (error) {
    console.error('Error updating stock on order action:', error);
    return { success: false, message: error.message };
  }
};
