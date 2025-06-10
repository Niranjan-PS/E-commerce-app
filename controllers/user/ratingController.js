import { Product } from "../../model/productModel.js";
import { Review } from "../../model/reviewModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";
import HttpStatus from "../../helpers/httpStatus.js";


export const rateProduct = catchAsyncError(async (req, res, next) => {
  try {
    const { id: productId } = req.params;
    const { rating } = req.body;
    const userId = req.user._id;

    
    if (!rating || rating < 1 || rating > 5 || !Number.isInteger(Number(rating))) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5'
      });
    }

    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Product not found'
      });
    }

    
    if (product.isBlocked || product.isDeleted || product.status !== "Available") {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'This product is currently not available for rating'
      });
    }

   
    const existingRatingIndex = product.ratings.findIndex(
      r => r.userId.toString() === userId.toString()
    );

    if (existingRatingIndex !== -1) {
      
      product.ratings[existingRatingIndex].rating = parseInt(rating);
      product.ratings[existingRatingIndex].createdAt = new Date();
    } else {
     
      product.ratings.push({
        userId: userId,
        rating: parseInt(rating),
        createdAt: new Date()
      });
    }

    await product.save();

    
    await Product.updateProductRating(productId);

    
    const updatedProduct = await Product.findById(productId);

    res.status(HttpStatus.OK).json({
      success: true,
      message: existingRatingIndex !== -1 ? 'Rating updated successfully' : 'Rating added successfully',
      data: {
        productId: productId,
        userRating: parseInt(rating),
        averageRating: updatedProduct.averageRating,
        ratingCount: updatedProduct.ratingCount,
        reviewCount: updatedProduct.reviewCount
      }
    });

  } catch (error) {
    console.error('Error rating product:', error);
    return next(new ErrorHandler('Failed to rate product', HttpStatus.INTERNAL_SERVER_ERROR));
  }
});


export const updateProductRating = catchAsyncError(async (req, res, next) => {
  try {
    const { id: productId } = req.params;

    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Product not found'
      });
    }

   
    const updatedProduct = await Product.updateProductRating(productId);

    if (!updatedProduct) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to update product rating'
      });
    }

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Product rating updated successfully',
      data: {
        productId: productId,
        averageRating: updatedProduct.averageRating,
        ratingCount: updatedProduct.ratingCount,
        reviewCount: updatedProduct.reviewCount
      }
    });

  } catch (error) {
    console.error('Error updating product rating:', error);
    return next(new ErrorHandler('Failed to update product rating', HttpStatus.INTERNAL_SERVER_ERROR));
  }
});


export const getUserRating = catchAsyncError(async (req, res, next) => {
  try {
    const { id: productId } = req.params;
    const userId = req.user._id;

   
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Product not found'
      });
    }

   
    const userRating = product.ratings.find(
      r => r.userId.toString() === userId.toString()
    );

    res.status(HttpStatus.OK).json({
      success: true,
      data: {
        productId: productId,
        userRating: userRating ? userRating.rating : null,
        hasRated: !!userRating,
        ratedAt: userRating ? userRating.createdAt : null
      }
    });

  } catch (error) {
    console.error('Error getting user rating:', error);
    return next(new ErrorHandler('Failed to get user rating', HttpStatus.INTERNAL_SERVER_ERROR));
  }
});


export const getProductRatingStats = catchAsyncError(async (req, res, next) => {
  try {
    const { id: productId } = req.params;

    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Product not found'
      });
    }

    
    const reviewRatingDistribution = await Review.aggregate([
      { $match: { product: product._id, isApproved: true } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    
    const directRatingDistribution = {};
    product.ratings.forEach(rating => {
      directRatingDistribution[rating.rating] = (directRatingDistribution[rating.rating] || 0) + 1;
    });

    const combinedDistribution = {};
    for (let i = 1; i <= 5; i++) {
      const reviewCount = reviewRatingDistribution.find(r => r._id === i)?.count || 0;
      const directCount = directRatingDistribution[i] || 0;
      combinedDistribution[i] = reviewCount + directCount;
    }

    res.status(HttpStatus.OK).json({
      success: true,
      data: {
        productId: productId,
        averageRating: product.averageRating,
        ratingCount: product.ratingCount,
        reviewCount: product.reviewCount,
        ratingDistribution: combinedDistribution
      }
    });

  } catch (error) {
    console.error('Error getting product rating stats:', error);
    return next(new ErrorHandler('Failed to get product rating statistics', HttpStatus.INTERNAL_SERVER_ERROR));
  }
});
