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
    
    // Stock status filter
    if (stockStatus === 'low') {
      query.quantity = { $lte: 10 }; // Low stock threshold
    } else if (stockStatus === 'out') {
      query.quantity = 0;
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
    
    // Get inventory statistics
    const inventoryStats = await Product.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStock: { $sum: '$quantity' },
          lowStockCount: {
            $sum: {
              $cond: [{ $lte: ['$quantity', 10] }, 1, 0]
            }
          },
          outOfStockCount: {
            $sum: {
              $cond: [{ $eq: ['$quantity', 0] }, 1, 0]
            }
          },
          totalValue: {
            $sum: { $multiply: ['$quantity', '$salePrice'] }
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
    
    if (!quantity || quantity < 0) {
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
    
    let newQuantity;
    
    switch (action) {
      case 'set':
        newQuantity = parseInt(quantity);
        break;
      case 'add':
        newQuantity = product.quantity + parseInt(quantity);
        break;
      case 'subtract':
        newQuantity = Math.max(0, product.quantity - parseInt(quantity));
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
        productName: product.productName,
        quantity: product.quantity,
        previousQuantity: action === 'set' ? null : 
                         action === 'add' ? product.quantity - parseInt(quantity) :
                         product.quantity + parseInt(quantity)
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
        
        const product = await Product.findById(productId);
        if (!product) {
          errors.push(`Product ${productId} not found`);
          continue;
        }
        
        let newQuantity;
        
        switch (action) {
          case 'set':
            newQuantity = parseInt(quantity);
            break;
          case 'add':
            newQuantity = product.quantity + parseInt(quantity);
            break;
          case 'subtract':
            newQuantity = Math.max(0, product.quantity - parseInt(quantity));
            break;
          default:
            errors.push(`Invalid action for product ${product.productName}`);
            continue;
        }
        
        product.quantity = newQuantity;
        await product.save();
        
        results.push({
          productId: product._id,
          productName: product.productName,
          newQuantity: newQuantity,
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
    
    // Get products with low stock
    const lowStockProducts = await Product.find({
      isDeleted: false,
      quantity: { $lte: lowStockThreshold }
    })
    .populate('category', 'name')
    .sort({ quantity: 1 });
    
    // Get out of stock products
    const outOfStockProducts = await Product.find({
      isDeleted: false,
      quantity: 0
    })
    .populate('category', 'name')
    .sort({ productName: 1 });
    
    res.render("admin/stock-alerts", {
      lowStockProducts,
      outOfStockProducts,
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
    
    // Get recent orders that affected stock
    const stockMovements = await Order.find({})
      .populate('user', 'name email')
      .populate('items.product', 'productName')
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalMovements = await Order.countDocuments({});
    const totalPages = Math.ceil(totalMovements / limit);
    
    res.render("admin/stock-movements", {
      stockMovements,
      currentPage: page,
      totalPages,
      totalMovements,
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
      
      switch (action) {
        case 'place':
          // Decrease stock when order is placed
          product.quantity = Math.max(0, product.quantity - item.quantity);
          break;
          
        case 'cancel':
          // Restore stock when order is cancelled
          product.quantity += item.quantity;
          break;
          
        case 'return':
          // Restore stock when order is returned
          const returnedQuantity = item.returnedQuantity || item.quantity;
          product.quantity += returnedQuantity;
          break;
          
        default:
          console.error(`Unknown stock action: ${action}`);
          continue;
      }
      
      await product.save();
    }
    
    return { success: true, message: 'Stock updated successfully' };
    
  } catch (error) {
    console.error('Error updating stock on order action:', error);
    return { success: false, message: error.message };
  }
};
