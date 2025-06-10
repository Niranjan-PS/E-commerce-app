import { Product } from "../../model/productModel.js";
import { Category } from "../../model/categoryModel.js";
import HttpStatus from "../../helpers/httpStatus.js";

export const getUserProductList = async (req, res) => {
  try {
    const ITEMS_PER_PAGE = 8;

    const page = parseInt(req.query.page) || 1;
    const searchQuery = req.query.search || "";
    const categoryFilter = req.query.category || "";
    const minRating = parseFloat(req.query.minRating) || 0;
    const sortBy = req.query.sortBy || "";

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

    // rating filter
    if (minRating > 0 && minRating <= 5) {
      filter.averageRating = { $gte: minRating };
    }

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE);


    let sortCriteria = {};
    switch (sortBy) {
      case 'rating':
        sortCriteria = { averageRating: -1, ratingCount: -1 };
        break;
      case 'price_low':
        sortCriteria = { salePrice: 1, price: 1 };
        break;
      case 'price_high':
        sortCriteria = { salePrice: -1, price: -1 };
        break;
      case 'newest':
      default:
        sortCriteria = { createdAt: -1 };
        break;
    }

    const products = await Product.find(filter)
      .populate("category")
      .sort(sortCriteria)
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
          quantity: product.quantity,
          rating: product.rating,
          averageRating: product.averageRating || 0,
          ratingCount: product.ratingCount || 0,
          reviewCount: product.reviewCount,
          category: product.category ? {
            _id: product.category._id,
            categoryName: product.category.name
          } : { categoryName: 'Uncategorized' },
          productImage: product.productImage || [],
          status: product.status
        })),
        categories: categories.map(category => ({
          _id: category._id,
          name: category.name
        })),
        totalPages,
        currentPage: page,
        totalProducts: totalProducts,
        itemsPerPage: ITEMS_PER_PAGE,
        searchQuery,
        categoryFilter,
        minRating,
        sortBy
      });
    }


    res.render("user-products", {
      products,
      categories,
      currentPage: page,
      totalPages,
      searchQuery,
      categoryFilter,
      minRating,
      sortBy
    });
  } catch (error) {
    console.error("Error loading user products:", error);
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('application/json');
    if (isAjax) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Server error"
      });
    }
    res.redirect("/pageNotFound");
  }
};