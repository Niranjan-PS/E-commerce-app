import ErrorHandler from "../../middlewares/error.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import { Product } from '../../model/productModel.js';
import { Category } from '../../model/categoryModel.js';
import { ProductOffer } from '../../model/productOfferModel.js';
import HttpStatus from '../../helpers/httpStatus.js';
import { calculateBestOfferPrice, calculateOfferPricesForProducts } from '../../utils/offerCalculator.js';


export const loadHomePage = async (req, res) => {
  try {
    const { page = 1, section, search = '', category = '' } = req.query;
    const limit = section === 'featured' ? 4 : 8;
    const skip = (parseInt(page) - 1) * limit;


    const query = {
      status: 'Available',
      isBlocked: { $ne: true },
      isDeleted: { $ne: true }
    };


    if (search) {
      query.productName = { $regex: search, $options: 'i' };
    }
    if (category) {
      query.category = category;
    }


    if (req.get('X-Requested-With') === 'XMLHttpRequest') {
      let products;
      let totalProducts;

      if (section === 'featured') {

        query.isFeatured = true;
        products = await Product.find(query)
          .populate('category')
          .skip(skip)
          .limit(limit);
        totalProducts = await Product.countDocuments(query);
      } else if (section === 'latest') {

        products = await Product.find(query)
          .sort({ createdAt: -1 })
          .populate('category')
          .skip(skip)
          .limit(limit);
        totalProducts = await Product.countDocuments(query);
      } else {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Invalid section parameter. Use "featured" or "latest".'
        });
      }

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
          averageRating: product.averageRating,
          ratingCount: product.ratingCount,
          reviewCount: product.reviewCount,
          category: product.category ? product.category.name : 'Uncategorized',
          productImage: product.productImage || [],
          status: product.status,
          isFeatured: product.isFeatured
        })),
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalProducts / limit),
        searchQuery: search,
        categoryFilter: category
      });
    }


    const featuredProductsRaw = await Product.find({
      status: 'Available',
      isBlocked: { $ne: true },
      isDeleted: { $ne: true },
      isFeatured: true
    })
      .populate('category')
      .limit(4);

    // Add offer details to featured products using the new utility
    const featuredProducts = await calculateOfferPricesForProducts(featuredProductsRaw);

    const latestProductsRaw = await Product.find({
      status: 'Available',
      isBlocked: { $ne: true },
      isDeleted: { $ne: true }
    })
      .sort({ createdAt: -1 })
      .populate('category')
      .limit(8);

    // Add offer details to latest products using the new utility
    const latestProducts = await calculateOfferPricesForProducts(latestProductsRaw);

    const categories = await Category.find({ isListed: true });

    res.render('user/home', {
      featuredProducts,
      latestProducts,
      categories,
      user: req.user || null
    });
  } catch (err) {
    console.error('Error loading home page:', err);
    if (req.get('X-Requested-With') === 'XMLHttpRequest') {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Server error while fetching products.'
      });
    }
    res.redirect('/pagenotFound');
  }
};

export const loadShopPage = async (req, res) => {
  const searchQuery = req.query.search || "";
  const categoryFilter = req.query.category || "";
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = 8;
  const sortBy = req.query.sortBy || "";
  const minPrice = parseFloat(req.query.minPrice) || 0;
  const maxPrice = parseFloat(req.query.maxPrice) || Number.MAX_VALUE;
  const minRating = parseFloat(req.query.minRating) || 0;

  try {
    const categories = await Category.find({ isListed: true });


    const filter = {
      status: "Available",
      isBlocked: { $ne: true },
      isDeleted: { $ne: true }
    };


    if (searchQuery) {
      filter.productName = { $regex: searchQuery, $options: "i" };
    }


    if (categoryFilter) {
      const cleanCategory = categoryFilter.replace(/^:/, '');
      const category = await Category.findOne({ name: cleanCategory });
      if (category) {
        filter.category = category._id;
      }
    }


    if (minPrice > 0 || maxPrice < Number.MAX_VALUE) {
      filter.$or = [
        { salePrice: { $gte: minPrice, $lte: maxPrice } },
        { $and: [{ salePrice: { $exists: false } }, { price: { $gte: minPrice, $lte: maxPrice } }] }
      ];
    }


    if (minRating > 0) {
      filter.averageRating = { $gte: minRating };
    }


    let sortOptions = { createdAt: -1 };
    switch (sortBy) {
      case 'price_low_high':
        sortOptions = { salePrice: 1, price: 1 };
        break;
      case 'price_high_low':
        sortOptions = { salePrice: -1, price: -1 };
        break;
      case 'name_a_z':
        sortOptions = { productName: 1 };
        break;
      case 'name_z_a':
        sortOptions = { productName: -1 };
        break;
      case 'rating_high_low':
        sortOptions = { averageRating: -1, ratingCount: -1 };
        break;
      case 'newest':
        sortOptions = { createdAt: -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const totalCount = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    const productsRaw = await Product.find(filter)
      .populate("category")
      .sort(sortOptions)
      .skip((page - 1) * itemsPerPage)
      .limit(itemsPerPage);

    // Add offer details to shop products using the new utility
    const products = await calculateOfferPricesForProducts(productsRaw);

    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('application/json');

    if (isAjax) {

      return res.json({
        success: true,
        products: products.map(product => ({
          _id: product._id,
          productName: product.productName,
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
        totalProducts: totalCount,
        itemsPerPage,
        searchQuery,
        categoryFilter,
        sortBy,
        minPrice,
        maxPrice,
        minRating
      });
    }


    res.render("user/shop", {
      products,
      categories,
      searchQuery,
      categoryFilter,
      totalPages,
      currentPage: page,
      sortBy,
      minPrice,
      maxPrice,
      minRating,
      user: req.user || null,
      breadcrumbs: [
        { name: "Home", url: "/" },
        { name: "Shop", url: "/shop", active: true }
      ]
    });
  } catch (err) {
    console.error("Error loading shop page:", err);
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('application/json');
    if (isAjax) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Server error"
      });
    }
    res.redirect('/pagenotFound')
  }
};

export const getProductDetails = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;

    const productExists = await Product.findById(id).populate("category");

    if (!productExists) {
      return res.redirect('/shop?error=Product+not+found');
    }

    if (productExists.isBlocked || productExists.isDeleted || productExists.status !== "Available") {
      return res.redirect('/shop?error=Product+is+not+available');
    }

    const product = productExists;

    // Calculate offer details using the new utility
    const offerCalculation = await calculateBestOfferPrice(product);
    
    // Format offer details for the view
    let offerDetails = null;
    if (offerCalculation.hasOffer && offerCalculation.offerDetails) {
      const offer = offerCalculation.offerDetails;
      offerDetails = {
        id: offer.id,
        name: offer.name,
        discountPercentage: offer.discountPercentage,
        type: offer.type,
        startDate: offer.startDate,
        endDate: offer.endDate,
        originalPrice: offerCalculation.originalPrice,
        discountedPrice: offerCalculation.discountedPrice,
        savings: offerCalculation.savings,
        isActive: true,
        validityText: `Valid till ${offer.endDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })}`
      };
    }

    const relatedProductsRaw = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      status: "Available",
      isBlocked: { $ne: true },
      isDeleted: { $ne: true }
    })
    .populate("category")
    .limit(4);

    // Add offer details to related products using the new utility
    const relatedProducts = await calculateOfferPricesForProducts(relatedProductsRaw);

    // Ensure rating fields are available
    if (!product.averageRating) product.averageRating = 0;
    if (!product.ratingCount) product.ratingCount = 0;

    const categories = await Category.find({ isListed: true });

    res.render("user/product-details", {
      product,
      activeOffer: offerDetails,
      relatedProducts,
      categories,
      user: req.user || null,
      breadcrumbs: [
        { name: "Home", url: "/" },
        { name: "Shop", url: "/shop" },
        { name: product.productName, url: `/product/${product._id}`, active: true }
      ]
    });
  } catch (error) {
    console.error("Error fetching product details:", error);
    return next(new ErrorHandler("Error fetching product details", 500));
  }
});



export const pagenotFound = catchAsyncError(async (req, res, next) => {
  try {
    res.render("user/page-404")
  } catch (error) {
    console.error("Error rendering 404 page:", error);
    return next(new ErrorHandler("Sorry! Page not found", 404))
  }
})