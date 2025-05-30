import { Review } from "../../model/reviewModel.js";
import { Product } from "../../model/productModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";

// Add a review
export const addReview = catchAsyncError(async (req, res, next) => {
  try {
    const { productId, rating, comment } = req.body;
    const userId = req.user._id;

    console.log('=== ADD REVIEW DEBUG ===');
    console.log('Request user:', req.user);
    console.log('User ID:', userId);
    console.log('User name:', req.user.name);
    console.log('User email:', req.user.email);
    console.log('User isAdmin:', req.user.isAdmin);

    // Validate input
    if (!productId || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, rating, and comment are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
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
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    // Create new review
    const review = new Review({
      user: userId,
      product: productId,
      rating: parseInt(rating),
      comment: comment.trim()
    });

    await review.save();

    // Update product rating
    const reviewStats = await Review.calculateAverageRating(productId);
    await Product.findByIdAndUpdate(productId, {
      rating: reviewStats.averageRating,
      reviewCount: reviewStats.reviewCount
    });

    // Populate user info for response
    await review.populate('user', 'name email');

    console.log('Review created with user:', review.user);
    console.log('Current user from req.user:', req.user);

    res.status(201).json({
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
    return next(new ErrorHandler('Failed to add review', 500));
  }
});

// Get reviews for a product
export const getProductReviews = catchAsyncError(async (req, res, next) => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Get reviews with pagination
    const reviews = await Review.find({
      product: productId,
      isApproved: true
    })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Ensure user names are properly formatted
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

    const totalReviews = await Review.countDocuments({
      product: productId,
      isApproved: true
    });

    const totalPages = Math.ceil(totalReviews / limit);

    // Get rating distribution
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
      ratingDistribution
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return next(new ErrorHandler('Failed to fetch reviews', 500));
  }
});

// Update a review
export const updateReview = catchAsyncError(async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;

    // Find the review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns the review
    if (review.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own reviews'
      });
    }

    // Update review
    if (rating) review.rating = parseInt(rating);
    if (comment) review.comment = comment.trim();

    await review.save();

    // Update product rating
    const reviewStats = await Review.calculateAverageRating(review.product);
    await Product.findByIdAndUpdate(review.product, {
      rating: reviewStats.averageRating,
      reviewCount: reviewStats.reviewCount
    });

    await review.populate('user', 'name');

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      review
    });
  } catch (error) {
    console.error('Error updating review:', error);
    return next(new ErrorHandler('Failed to update review', 500));
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
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns the review
    if (review.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own reviews'
      });
    }

    const productId = review.product;
    await Review.findByIdAndDelete(reviewId);

    // Update product rating
    const reviewStats = await Review.calculateAverageRating(productId);
    await Product.findByIdAndUpdate(productId, {
      rating: reviewStats.averageRating,
      reviewCount: reviewStats.reviewCount
    });

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    return next(new ErrorHandler('Failed to delete review', 500));
  }
});
