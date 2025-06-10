import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        
        const trimmed = v.trim();
        if (trimmed.length === 0) return false;
        
       
        if (/^\d+$/.test(trimmed)) return false;
        
        return true;
      },
      message: 'Review comment cannot be empty, contain only spaces, or contain only numbers'
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  helpfulCount: {
    type: Number,
    default: 0
  },
  isApproved: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });


reviewSchema.index({ user: 1, product: 1 }, { unique: true });


reviewSchema.statics.calculateAverageRating = async function(productId) {
  const result = await this.aggregate([
    { $match: { product: productId, isApproved: true } },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 }
      }
    }
  ]);
  
  return result.length > 0 ? result[0] : { averageRating: 0, reviewCount: 0 };
};

export const Review = mongoose.model("Review", reviewSchema);
