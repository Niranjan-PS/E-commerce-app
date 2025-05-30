import { Product } from "../../model/productModel.js";
import { Category } from "../../model/categoryModel.js";

export const getUserProductList = async (req, res) => {
  try {
    const ITEMS_PER_PAGE = 8;

    const page = parseInt(req.query.page) || 1;
    const searchQuery = req.query.search || "";
    const categoryFilter = req.query.category || "";

    const filter = {
      status: "Available",
      isBlocked: { $ne: true },
      isDeleted: { $ne: true }
    };

    if (searchQuery.trim() !== "") {
      filter.productName = { $regex: new RegExp(searchQuery, "i") };
    }

    if (categoryFilter) {
      const cleanCategory = categoryFilter.replace(/^:/, '');
      const category = await Category.findOne({ name: cleanCategory });
      if (category) {
        filter.category = category._id;
      }
    }

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE);

    const products = await Product.find(filter)
      .populate("category")
      .skip((page - 1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE);

    const categories = await Category.find({ isListed: true });


    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('application/json');

    if (isAjax) {

      return res.json({
        success: true,
        products: products.map(product => ({
          _id: product._id,
          productName: product.productName,
          description: product.description,
          price: product.price,
          salePrice: product.salePrice,
          discount: product.discount,
          rating: product.rating,
          reviewCount: product.reviewCount,
          category: product.category ? product.category.name : 'Uncategorized',
          productImage: product.productImage || [],
          status: product.status
        })),
        categories: categories.map(category => ({
          _id: category._id,
          name: category.name
        })),
        totalPages,
        currentPage: page,
        searchQuery,
        categoryFilter
      });
    }


    res.render("user-products", {
      products,
      categories,
      currentPage: page,
      totalPages,
      searchQuery,
      categoryFilter
    });
  } catch (error) {
    console.error("Error loading user products:", error);
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('application/json');
    if (isAjax) {
      return res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
    res.redirect("/pageNotFound");
  }
};