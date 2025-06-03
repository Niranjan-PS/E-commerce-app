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
  getReturnRequests
} from "../controllers/admin/adminOrderController.js";

import {
  getInventoryDashboard,
  updateStock,
  bulkUpdateStock,
  getLowStockAlerts,
  getStockMovements
} from "../controllers/admin/inventoryController.js";



router.get('/admin-login',loadLogin)
router.post('/admin-login',adminLogin)
router.get('/logout', isAdminAuthenticated, adminLogout)
router.get('/', isAdminAuthenticated, loadAdminDashboard)
router.get('/dashboard', isAdminAuthenticated, (req, res) => {
  res.render('dashboard');
});
router.get("/users", isAdminAuthenticated, customerInfo)

router.get('/blockUser', isAdminAuthenticated, async (req, res) => {
  const userId = req.query.id;

  if (!userId) return res.status(400).send("User ID is required");

  try {
    await User.findByIdAndUpdate(userId, { isBlocked: true });
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    res.status(500).send("Invalid User ID");
  }
});
router.patch('/blockUser', isAdminAuthenticated, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.query.id, { isBlocked: true });
    // Note: User will be automatically logged out when they make their next request due to middleware check
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

// Order management routes
router.get('/orders', isAdminAuthenticated, getAdminOrders);
router.get('/orders/:orderId', isAdminAuthenticated, getAdminOrderDetails);
router.post('/orders/:orderId/status', isAdminAuthenticated, updateOrderStatus);
router.post('/orders/:orderId/return', isAdminAuthenticated, handleReturnRequest);
router.get('/return-requests', isAdminAuthenticated, getReturnRequests);

// Inventory management routes
router.get('/inventory', isAdminAuthenticated, getInventoryDashboard);
router.post('/inventory/:productId/stock', isAdminAuthenticated, updateStock);
router.post('/inventory/bulk-update', isAdminAuthenticated, bulkUpdateStock);
router.get('/inventory/alerts', isAdminAuthenticated, getLowStockAlerts);
router.get('/inventory/movements', isAdminAuthenticated, getStockMovements);

export default router;




