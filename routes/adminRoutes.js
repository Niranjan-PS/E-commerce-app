import express from 'express'
const router = express.Router()
import { User } from '../model/userModel.js'
import { Category } from '../model/categoryModel.js';
import { customerInfo } from "../controllers/admin/customerController.js"
import {categoryInfo,addCategory, getEditCategory,EditCategory,deleteCategory} from "../controllers/admin/categoryController.js"
import {loadLogin,adminLogin,loadAdminDashboard,adminLogout} from "../controllers/admin/adminController.js"
import { toggleCategoryStatus } from '../controllers/admin/categoryController.js'
import {upload} from '../helpers/multer.js'
import { isAdminAuthenticated } from '../middlewares/auth.js'

import {
  getProductAddPage,
  addProducts,
  getProductList,
  deleteProduct,
  toggleBlockProduct,
  getEditProductPage,
  editProduct,
} from "../controllers/admin/productController.js";

import {
  getAdminOrders,
  getAdminOrderDetails,
  updateOrderStatus,
  handleReturnRequest,
  handleIndividualItemReturn,
  getReturnRequests
} from "../controllers/admin/adminOrderController.js";

import {
  getInventoryDashboard,
  updateStock,
  bulkUpdateStock,
  getLowStockAlerts,
  getStockMovements
} from "../controllers/admin/inventoryController.js";

import {
  getCoupons,
  getAddCoupon,
  createCoupon,
  getEditCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  getCouponDetails
} from "../controllers/admin/couponController.js";

import {
  getProductOffers,
  getAddProductOffer,
  createProductOffer,
  getEditProductOffer,
  updateProductOffer,
  deleteProductOffer,
  toggleProductOfferStatus,
  getProductOfferDetails,
  checkProductAvailability
} from "../controllers/admin/productOfferController.js";

import {
  getCategoryOffers,
  getAddCategoryOffer,
  createCategoryOffer,
  getEditCategoryOffer,
  updateCategoryOffer,
  deleteCategoryOffer,
  toggleCategoryOfferStatus,
  getCategoryOfferDetails,
  checkCategoryAvailability
} from "../controllers/admin/categoryOfferController.js";

import {
  getSalesReports,
  getSalesData,
  exportSalesReportPDF,
  exportSalesReportExcel
} from "../controllers/admin/salesReportController.js";

import {
  getSalesAnalytics,
  getTopProducts,
  getTopCategories,
  getDashboardStats
} from "../controllers/admin/analyticsController.js";


//admin
router.get('/admin-login',loadLogin)
router.post('/admin-login',adminLogin)
router.get('/logout', isAdminAuthenticated, adminLogout)
router.get('/', isAdminAuthenticated, loadAdminDashboard)
router.get('/dashboard', isAdminAuthenticated, (req, res) => {
  res.render('admin/dashboard');
});

//customers or users
router.get("/users", isAdminAuthenticated, customerInfo)
router.patch('/blockUser', isAdminAuthenticated, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.query.id, { isBlocked: true });
    res.status(200).json({ success: true, message: 'User blocked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to block user' });
  }
});

router.patch('/unblockUser', isAdminAuthenticated, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.query.id, { isBlocked: false });
    res.status(200).json({ success: true, message: 'User unblocked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to unblock user' });
  }
});

//category
router.get("/category", isAdminAuthenticated, categoryInfo)
router.post("/addCategory", isAdminAuthenticated, addCategory)
router.patch('/category/toggle/:id', isAdminAuthenticated, toggleCategoryStatus);
router.get("/editCategory", isAdminAuthenticated, getEditCategory)
router.post("/editCategory/:id", isAdminAuthenticated, EditCategory)
router.post('/deleteCategory', isAdminAuthenticated, deleteCategory);

//product
router.get('/add-products', isAdminAuthenticated, async (req, res) => {
  try {
    const cat = await Category.find({});
    res.render('product-add', {
      cat,
      error: req.query.error
    });
  } catch (error) {
    console.error(error);
    res.redirect('/PageNotFound');
  }
});

router.post('/add-products', isAdminAuthenticated, upload.array('images', 4), addProducts);
router.get('/products', isAdminAuthenticated, getProductList);
router.delete('/delete-product', isAdminAuthenticated, deleteProduct);
router.get('/block-product/:id', isAdminAuthenticated, toggleBlockProduct);
router.get('/edit-product/:id', isAdminAuthenticated, getEditProductPage);
router.post(
  '/edit-product/:id',
  isAdminAuthenticated,
  upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
  ]),
  editProduct
);

// Order
router.get('/orders', isAdminAuthenticated, getAdminOrders);
router.get('/orders/:orderId', isAdminAuthenticated, getAdminOrderDetails);
router.post('/orders/:orderId/status', isAdminAuthenticated, updateOrderStatus);
router.post('/orders/:orderId/return', isAdminAuthenticated, handleReturnRequest);
router.post('/orders/:orderId/items/:itemId/return', isAdminAuthenticated, handleIndividualItemReturn);
router.get('/return-requests', isAdminAuthenticated, getReturnRequests);


//inventory
router.get('/inventory', isAdminAuthenticated, getInventoryDashboard);
router.post('/inventory/:productId/stock', isAdminAuthenticated, updateStock);
router.post('/inventory/bulk-update', isAdminAuthenticated, bulkUpdateStock);
router.get('/inventory/alerts', isAdminAuthenticated, getLowStockAlerts);
router.get('/inventory/movements', isAdminAuthenticated, getStockMovements);

// Coupon routes
router.get('/coupons', isAdminAuthenticated, getCoupons);
router.get('/coupons/add', isAdminAuthenticated, getAddCoupon);
router.post('/coupons/add', isAdminAuthenticated, createCoupon);
router.get('/coupons/edit/:id', isAdminAuthenticated, getEditCoupon);
router.post('/coupons/edit/:id', isAdminAuthenticated, updateCoupon);
router.delete('/coupons/:id', isAdminAuthenticated, deleteCoupon);
router.patch('/coupons/:id/toggle', isAdminAuthenticated, toggleCouponStatus);
router.get('/coupons/:id/details', isAdminAuthenticated, getCouponDetails);

//update coupon validaity dates
router.post('/coupons/:code/fix-dates', isAdminAuthenticated, async (req, res) => {
  try {
    const { Coupon } = await import("../../model/couponModel.js");
    const { code } = req.params;
    
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }
    
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    coupon.validFrom = now;
    coupon.validUntil = oneWeekFromNow;
    await coupon.save();
    
    res.json({
      success: true,
      message: 'Coupon dates updated',
      coupon: {
        code: coupon.code,
        validFrom: coupon.validFrom,
        validUntil: coupon.validUntil,
        isValid: coupon.isValid()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Product Offer routes
router.get('/product-offers', isAdminAuthenticated, getProductOffers);
router.get('/product-offers/add', isAdminAuthenticated, getAddProductOffer);
router.post('/product-offers/add', isAdminAuthenticated, createProductOffer);
router.get('/product-offers/edit/:id', isAdminAuthenticated, getEditProductOffer);
router.post('/product-offers/edit/:id', isAdminAuthenticated, updateProductOffer);
router.delete('/product-offers/:id', isAdminAuthenticated, deleteProductOffer);
router.patch('/product-offers/:id/toggle', isAdminAuthenticated, toggleProductOfferStatus);
router.get('/product-offers/:id/details', isAdminAuthenticated, getProductOfferDetails);
router.get('/product-offers/check-availability', isAdminAuthenticated, checkProductAvailability);

// Category Offer routes
router.get('/category-offers', isAdminAuthenticated, getCategoryOffers);
router.get('/category-offers/add', isAdminAuthenticated, getAddCategoryOffer);
router.post('/category-offers/add', isAdminAuthenticated, createCategoryOffer);
router.get('/category-offers/edit/:id', isAdminAuthenticated, getEditCategoryOffer);
router.post('/category-offers/edit/:id', isAdminAuthenticated, updateCategoryOffer);
router.delete('/category-offers/:id', isAdminAuthenticated, deleteCategoryOffer);
router.patch('/category-offers/:id/toggle', isAdminAuthenticated, toggleCategoryOfferStatus);
router.get('/category-offers/:id/details', isAdminAuthenticated, getCategoryOfferDetails);
router.get('/category-offers/check-availability', isAdminAuthenticated, checkCategoryAvailability);

// Sales Reports routes
router.get('/sales-reports', isAdminAuthenticated, getSalesReports);
router.get('/api/sales-data', isAdminAuthenticated, getSalesData);
router.get('/export-sales-report-pdf', isAdminAuthenticated, exportSalesReportPDF);
router.get('/export-sales-report-excel', isAdminAuthenticated, exportSalesReportExcel);

// Analytics API routes
router.get('/api/analytics/sales', isAdminAuthenticated, getSalesAnalytics);
router.get('/api/analytics/top-products', isAdminAuthenticated, getTopProducts);
router.get('/api/analytics/top-categories', isAdminAuthenticated, getTopCategories);
router.get('/api/analytics/dashboard-stats', isAdminAuthenticated, getDashboardStats);

export default router;


