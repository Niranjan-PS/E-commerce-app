import { Order } from '../../model/orderModel.js';
import { Product } from '../../model/productModel.js';
import { Category } from '../../model/categoryModel.js';
import mongoose from 'mongoose';


export const getSalesAnalytics = async (req, res) => {
  try {
    const { period = 'daily', startDate, endDate } = req.query;
    
    let dateFilter = {};
    let groupBy = {};
    let sortBy = {};
    
    
    if (startDate && endDate) {
      dateFilter = {
        orderDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      
      const now = new Date();
      let daysBack;
      
      switch (period) {
        case 'daily':
          daysBack = 30;
          break;
        case 'monthly':
          daysBack = 365;
          break;
        case 'yearly':
          daysBack = 1825; 
          break;
        default:
          daysBack = 30;
      }
      
      const startDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
      dateFilter = {
        orderDate: { $gte: startDate, $lte: now }
      };
    }
    
   
    switch (period) {
      case 'daily':
        groupBy = {
          year: { $year: '$orderDate' },
          month: { $month: '$orderDate' },
          day: { $dayOfMonth: '$orderDate' }
        };
        sortBy = { '_id.year': 1, '_id.month': 1, '_id.day': 1 };
        break;
      case 'monthly':
        groupBy = {
          year: { $year: '$orderDate' },
          month: { $month: '$orderDate' }
        };
        sortBy = { '_id.year': 1, '_id.month': 1 };
        break;
      case 'yearly':
        groupBy = {
          year: { $year: '$orderDate' }
        };
        sortBy = { '_id.year': 1 };
        break;
    }
    
    const salesData = await Order.aggregate([
      {
        $match: {
          ...dateFilter,
          orderStatus: { $in: ['Delivered', 'Shipped', 'Out for Delivery'] }
        }
      },
      {
        $group: {
          _id: groupBy,
          totalSales: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' }
        }
      },
      { $sort: sortBy }
    ]);
    
  
    const formattedData = salesData.map(item => {
      let label;
      switch (period) {
        case 'daily':
          label = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;
          break;
        case 'monthly':
          label = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
          break;
        case 'yearly':
          label = `${item._id.year}`;
          break;
      }
      
      return {
        label,
        totalSales: Math.round(item.totalSales * 100) / 100,
        orderCount: item.orderCount,
        averageOrderValue: Math.round(item.averageOrderValue * 100) / 100
      };
    });
    
    res.json({
      success: true,
      data: formattedData,
      period
    });
    
  } catch (error) {
    console.error('Error fetching sales analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales analytics'
    });
  }
};


export const getTopProducts = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        orderDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }
    
    const topProducts = await Order.aggregate([
      {
        $match: {
          ...dateFilter,
          orderStatus: { $in: ['Delivered', 'Shipped', 'Out for Delivery'] }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.productName' },
          totalQuantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.discountedPrice'] } },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalQuantitySold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $project: {
          productName: 1,
          totalQuantitySold: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          orderCount: 1,
          productImage: { $arrayElemAt: ['$productDetails.productImage', 0] }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: topProducts
    });
    
  } catch (error) {
    console.error('Error fetching top products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top products'
    });
  }
};


export const getTopCategories = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        orderDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }
    
    const topCategories = await Order.aggregate([
      {
        $match: {
          ...dateFilter,
          orderStatus: { $in: ['Delivered', 'Shipped', 'Out for Delivery'] }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.category',
          categoryName: { $first: '$items.category' },
          totalQuantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.discountedPrice'] } },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      {
        $project: {
          categoryName: 1,
          totalQuantitySold: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          orderCount: 1
        }
      }
    ]);
    
    res.json({
      success: true,
      data: topCategories
    });
    
  } catch (error) {
    console.error('Error fetching top categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top categories'
    });
  }
};


export const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    
    const { User } = await import('../../model/userModel.js');
    const totalUsers = await User.countDocuments({ isBlocked: false });
    
   
    const totalOrders = await Order.countDocuments();
    
    
    const totalSalesResult = await Order.aggregate([
      {
        $match: {
          orderStatus: { $in: ['Delivered'] }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].totalSales : 0;
    
   
    const totalPending = await Order.countDocuments({
      orderStatus: { $in: ['Pending', 'Pending Payment', 'Processing', 'Packed'] }
    });
    
   
    const monthlySalesResult = await Order.aggregate([
      {
        $match: {
          orderDate: { $gte: startOfMonth },
          orderStatus: { $in: ['Delivered'] }
        }
      },
      {
        $group: {
          _id: null,
          monthlySales: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    const monthlySales = monthlySalesResult.length > 0 ? monthlySalesResult[0].monthlySales : 0;
    
    res.json({
      success: true,
      data: {
        totalUsers,
        totalOrders,
        totalSales: Math.round(totalSales * 100) / 100,
        totalPending,
        monthlySales: Math.round(monthlySales * 100) / 100
      }
    });
    
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats'
    });
  }
};