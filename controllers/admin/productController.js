import {Product} from "../../model/productModel.js"
import {Category }from "../../model/categoryModel.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getProductAddPage = async (req, res) => {
  try {
    const cat= await Category.find({ isListed: true });
    const error = req.query.error || null;
    res.render("product-add", { cat,error });
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const addProducts = async (req, res) => {
  try {
    const productData = req.body;


    const productExists = await Product.findOne({ productName: productData.productName });
    if (productExists) {
      return res.redirect("/admin/add-products?error=Product+already+exists");
    }

    if (!req.files || req.files.length < 3) {
      return res.redirect("/admin/add-products?error=At+least+3+images+are+required");
    }

    if (req.files.length > 4) {
      return res.redirect("/admin/add-products?error=Maximum+4+images+allowed");
    }


    const images = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        images.push(file.filename);
      });
    }


    const categoryDoc = await Category.findOne({ name: productData.category });
    if (!categoryDoc) {
      return res.redirect("/admin/add-products?error=Invalid+category+name");
    }


    const status = productData.quantity > 0 ? "Available" : "Out of Stock";


    // Handle salePrice and discount
    const salePrice = productData.salePrice ? parseFloat(productData.salePrice) : null;
    const discount = productData.discount ? parseFloat(productData.discount) : 0;

    const product = new Product({
      productName: productData.productName,
      description: productData.description,
      category: categoryDoc._id,
      price: productData.price,
      salePrice: salePrice,
      discount: discount,
      quantity: productData.quantity,
      productImage: images,
      status,
    });

    await product.save();
    console.log("Product saved successfully with images:", images);

    return res.redirect("/admin/products");

  } catch (error) {
    console.error("Error saving product:", error);
    return res.redirect("/admin/pageerror");
  }
};






export const getProductList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const minPrice = parseFloat(req.query.minPrice) || 0;
    const maxPrice = parseFloat(req.query.maxPrice) || Number.MAX_VALUE;

    // Build filter object
    const filter = {};

    if (search) {
      filter.productName = { $regex: search, $options: 'i' };
    }

    if (category) {
      const categoryDoc = await Category.findOne({ name: category });
      if (categoryDoc) {
        filter.category = categoryDoc._id;
      }
    }

    if (minPrice > 0 || maxPrice < Number.MAX_VALUE) {
      filter.price = { $gte: minPrice, $lte: maxPrice };
    }

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find(filter)
      .populate('category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const validProducts = products.filter(product => product.category);
    const categories = await Category.find({ isListed: true });

    const message = typeof req.query.message === 'string' ? req.query.message : null;
    const error = typeof req.query.error === 'string' ? req.query.error : null;

    const startItem = skip + 1;
    const endItem = Math.min(skip + limit, totalProducts);

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        products: validProducts,
        categories: categories,
        currentPage: page,
        totalPages: totalPages,
        search,
        category,
        minPrice,
        maxPrice
      });
    }

    res.render('admin/product', {
      products: validProducts,
      categories: categories,
      currentPage: page,
      totalPages: totalPages,
      totalProducts: totalProducts,
      startItem: startItem,
      endItem: endItem,
      message: message,
      error: error,
      search,
      category,
      minPrice,
      maxPrice
    });
  } catch (error) {
    console.error('Error fetching products:', error.message);
    res.redirect('/admin/products?error=Failed+to+load+products');
  }
};
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(400).json({ message: 'Product ID is required' });
      }
      return res.redirect('/admin/products?error=Product+ID+is+required');
    }

    const product = await Product.findById(id);
    if (!product) {
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(404).json({ message: 'Product not found' });
      }
      return res.redirect('/admin/products?error=Product+not+found');
    }


    product.isDeleted = true;
    await product.save();
    console.log(`Product ${id} soft deleted successfully`);

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ message: 'Product soft deleted successfully' });
    }

    return res.redirect('/admin/products?message=Product+soft+deleted+successfully');
  } catch (error) {
    console.error('Error soft deleting product:', error.message);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(500).json({ message: 'Failed to soft delete product' });
    }
    return res.redirect('/admin/products?error=Failed+to+soft+delete+product');
  }
};

const toggleBlockProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.redirect("/admin/products?error=Product+not+found");
    }


    product.isBlocked = !product.isBlocked;
    await product.save();

    const statusMessage = product.isBlocked
      ? "Product has been blocked"
      : "Product has been unblocked";

    return res.redirect(`/admin/products?message=${statusMessage}`);
  } catch (error) {
    console.error("Error toggling product block status:", error);
    return res.redirect("/admin/products?error=Failed+to+update+product+status");
  }
};

const getEditProductPage = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId).populate("category");
    const categories = await Category.find({ isListed: true });

    if (!product) {
      return res.redirect("/admin/products?error=Product+not+found");
    }

    const error = req.query.error || null;
    res.render("edit-product", { product, categories, error });
  } catch (error) {
    console.error("Error fetching product for edit:", error);
    return res.redirect("/admin/pageerror");
  }
};

const editProduct = async (req, res) => {
  try {
    console.log('Edit product function called');
    const productId = req.params.id;
    const productData = req.body;
    console.log('Product ID:', productId);
    console.log('Request Body:', req.body);
    console.log('Request Files:', req.files);


    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.redirect(`/admin/edit-product/${productId}?error=Invalid+product+ID`);
    }


    const product = await Product.findById(productId);
    if (!product) {
      return res.redirect("/admin/products?error=Product+not+found");
    }


    if (!productData.category || typeof productData.category !== 'string' || productData.category.trim() === '') {
      return res.redirect(`/admin/edit-product/${productId}?error=Category+is+required`);
    }


    const existingImages = Array.isArray(product.productImage) ? [...product.productImage] : [];
    console.log("Existing images:", existingImages);


    const imageFields = ['image1', 'image2', 'image3', 'image4'];
    const updatedImages = [...existingImages];

    for (let i = 0; i < imageFields.length; i++) {
      const fieldName = imageFields[i];
      const files = req.files && req.files[fieldName];
      const file = files && files[0];

      if (file) {
        console.log(`Processing new image for ${fieldName}:`, file.filename);


        if (i < existingImages.length) {

          try {
            const oldImagePath = path.join(__dirname, "../../public/uploads/product-images", existingImages[i]);
            await fs.promises.unlink(oldImagePath).catch(err => {
              console.warn(`Failed to delete old image ${oldImagePath}: ${err.message}`);
            });
          } catch (err) {
            console.warn(`Error deleting old image: ${err.message}`);
          }


          updatedImages[i] = file.filename;
        } else {

          updatedImages.push(file.filename);
        }
      }
    }


    if (updatedImages.length < 3) {
      return res.redirect(`/admin/edit-product/${productId}?error=Product+must+have+at+least+3+images`);
    }


    const category = await Category.findOne({ name: productData.category.trim() });
    if (!category) {
      return res.redirect(`/admin/edit-product/${productId}?error=Invalid+category+name`);
    }


    product.productName = productData.productName?.trim() || product.productName;
    product.description = productData.description?.trim() || product.description;
    product.category = category._id;
    product.price = parseFloat(productData.price);
    product.salePrice = productData.salePrice ? parseFloat(productData.salePrice) : null;
    product.discount = productData.discount ? parseFloat(productData.discount) : 0;
    product.quantity = parseInt(productData.quantity);
    product.productImage = updatedImages;

    if (isNaN(product.price) || product.price < 0) {
      return res.redirect(`/admin/edit-product/${productId}?error=Invalid+price`);
    }
    if (isNaN(product.quantity) || product.quantity < 0) {
      return res.redirect(`/admin/edit-product/${productId}?error=Invalid+quantity`);
    }

    product.status = product.quantity > 0 ? "Available" : "Out of Stock";

    console.log("Saving product with images:", updatedImages);
    await product.save();
    return res.redirect("/admin/products?message=Product+updated+successfully");
  } catch (error) {
    console.error("Error updating product:", {
      message: error.message,
      stack: error.stack,
      productId: req.params.id,
      body: req.body,
      files: req.files
    });
    return res.redirect(`/admin/edit-product/${req.params.id}?error=Update+failed: ${encodeURIComponent(error.message)}`);
  }
};


export {
  getProductAddPage,
  addProducts,
  deleteProduct,
  toggleBlockProduct,
  getEditProductPage,
  editProduct,
};