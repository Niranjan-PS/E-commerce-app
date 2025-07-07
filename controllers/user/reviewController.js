import { Review } from "../../model/reviewModel.js";
import { Product } from "../../model/productModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";
import HttpStatus from "../../helpers/httpStatus.js";

// Add a review
export const addReview = catchAsyncError(async (req, res, next) => {
  try {
    const { productId, rating, comment } = req.body;
    const userId = req.user._id;

        
   
    if (!productId || !rating || !comment) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Product ID, rating, and comment are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      user: userId,
      product: productId
    });

    if (existingReview) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

   
    const review = new Review({
      user: userId,
      product: productId,
      rating: parseInt(rating),
      comment: comment.trim()
    });

    await review.save();

    
    await Product.updateProductRating(productId);

    
    await review.populate('user', 'name email');

    res.status(HttpStatus.CREATED).json({
      success: true,
      message: 'Review added successfully',
      review: {
        _id: review._id,
        rating: review.rating,
        comment: review.comment,
        user: {
          _id: review.user._id,
          name: review.user.name || review.user.email || 'Anonymous'
        },
        createdAt: review.createdAt
      }
    });
  } catch (error) {
    console.error('Error adding review:', error);
    return next(new ErrorHandler('Failed to add review', HttpStatus.INTERNAL_SERVER_ERROR));
  }
});


export const getProductReviews = catchAsyncError(async (req, res, next) => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const rating = parseInt(req.query.rating) || null; 
    const skip = (page - 1) * limit;

    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Product not found'
      });
    }

    const reviewFilter = {
      product: productId,
      isApproved: true
    };

   
    if (rating && rating >= 1 && rating <= 5) {
      reviewFilter.rating = rating;
    }

   
    const reviews = await Review.find(reviewFilter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    
    const formattedReviews = reviews.map(review => ({
      _id: review._id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      user: {
        _id: review.user._id,
        name: review.user.name || review.user.email || 'Anonymous'
      }
    }));

    const totalReviews = await Review.countDocuments(reviewFilter);

    const totalPages = Math.ceil(totalReviews / limit);


    const ratingDistribution = await Review.aggregate([
      { $match: { product: product._id, isApproved: true } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    res.status(200).json({
      success: true,
      reviews: formattedReviews,
      pagination: {
        currentPage: page,
        totalPages,
        totalReviews,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      ratingDistribution,
      filters: {
        rating: rating
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return next(new ErrorHandler('Failed to fetch reviews', 500));
  }
});


export const updateReview = catchAsyncError(async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;


    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Review not found'
      });
    }


    if (review.user.toString() !== userId.toString()) {
      return res.status(HttpStatus.FORBIDDEN).json({
        success: false,
        message: 'You can only update your own reviews'
      });
    }


    if (rating) review.rating = parseInt(rating);
    if (comment) review.comment = comment.trim();

    await review.save();

    // Update product rating 
    await Product.updateProductRating(review.product);

    await review.populate('user', 'name');

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Review updated successfully',
      review
    });
  } catch (error) {
    console.error('Error updating review:', error);
    return next(new ErrorHandler('Failed to update review', HttpStatus.INTERNAL_SERVER_ERROR));
  }
});

// Delete a review
export const deleteReview = catchAsyncError(async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;

    // Find the review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Review not found'
      });
    }

    
    if (review.user.toString() !== userId.toString()) {
      return res.status(HttpStatus.FORBIDDEN).json({
        success: false,
        message: 'You can only delete your own reviews'
      });
    }

    const productId = review.product;
    await Review.findByIdAndDelete(reviewId);

    // Update product rating
    await Product.updateProductRating(productId);

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    return next(new ErrorHandler('Failed to delete review', HttpStatus.INTERNAL_SERVER_ERROR));
  }
});
