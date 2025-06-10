import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const productSchema = new Schema({
  productName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  salePrice: {
    type: Number,
    default: null
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  quantity: {
    type: Number,
    required: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
    set: function(val) {
      return Math.round(val * 10) / 10; // Round to 1 decimal place
    }
  },
  ratingCount: {
    type: Number,
    default: 0
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  ratings: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  productImage: {
    type: [String],
    required: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ["Available", "Out of Stock", "Discontinued"],
    required: true,
    default: "Available"
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Static method to soft delete a product
productSchema.statics.softDelete = async function(productId) {
  return this.findByIdAndUpdate(
    productId,
    { isDeleted: true },
    { new: true }
  );
};

// Static method to restore a soft-deleted product
productSchema.statics.restoreDeleted = async function(productId) {
  return this.findByIdAndUpdate(
    productId,
    { isDeleted: false },
    { new: true }
  );
};

// Static method to find soft-deleted products
productSchema.statics.findDeleted = async function() {
  return this.find({ isDeleted: true }, null, { includeDeleted: true }).populate('category');
};

// Static method to find a product by ID including soft-deleted ones
productSchema.statics.findByIdWithDeleted = async function(productId) {
  // Use includeDeleted option to bypass middleware
  return this.findOne({ _id: productId }, null, { includeDeleted: true });
};

// Static method to calculate and update product rating
productSchema.statics.updateProductRating = async function(productId) {
  const Review = mongoose.model('Review');

  // Get review stats
  const reviewStats = await Review.calculateAverageRating(productId);

  // Get direct ratings from product
  const product = await this.findById(productId);
  if (!product) return null;

  const directRatings = product.ratings || [];
  const directRatingSum = directRatings.reduce((sum, r) => sum + r.rating, 0);
  const directRatingCount = directRatings.length;

  // Combine review ratings and direct ratings
  const totalRatingSum = (reviewStats.averageRating * reviewStats.reviewCount) + directRatingSum;
  const totalRatingCount = reviewStats.reviewCount + directRatingCount;

  const averageRating = totalRatingCount > 0 ? totalRatingSum / totalRatingCount : 0;

  // Update product with new ratings
  return this.findByIdAndUpdate(productId, {
    averageRating: Math.round(averageRating * 10) / 10,
    ratingCount: totalRatingCount,
    rating: Math.round(averageRating * 10) / 10, // Keep existing rating field for backward compatibility
    reviewCount: reviewStats.reviewCount
  }, { new: true });
};

// Query middleware to exclude soft-deleted products by default
productSchema.pre('find', function() {
  // Skip middleware if includeDeleted option is set
  if (!this.getOptions().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

productSchema.pre('findOne', function() {
  // Skip middleware if includeDeleted option is set
  if (!this.getOptions().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

productSchema.pre('countDocuments', function() {
  // Skip middleware if includeDeleted option is set
  if (!this.getOptions().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

export const Product = model('Product', productSchema);