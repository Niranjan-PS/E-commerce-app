import mongoose from "mongoose";

const categoryOfferSchema = new mongoose.Schema({
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  offerName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  discountPercentage: {
    type: Number,
    required: true,
    min: 1,
    max: 90,
    validate: {
      validator: function(value) {
        return value >= 1 && value <= 90;
      },
      message: 'Discount percentage must be between 1% and 90%'
    }
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        return value > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    default: 'Admin'
  },
  description: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});


categoryOfferSchema.index({ category: 1, startDate: 1, endDate: 1 });
categoryOfferSchema.index({ isActive: 1, startDate: 1, endDate: 1 });


categoryOfferSchema.virtual('isCurrentlyValid').get(function() {
  const now = new Date();
  return this.isActive && 
         now >= this.startDate && 
         now <= this.endDate;
});


categoryOfferSchema.methods.isValidAt = function(date = new Date()) {
  return this.isActive && 
         date >= this.startDate && 
         date <= this.endDate;
};


categoryOfferSchema.methods.calculateDiscountedPrice = function(originalPrice) {
 
  const now = new Date();
  const isValid = this.isActive && 
                  now >= this.startDate && 
                  now <= this.endDate;
  
  if (!isValid) {
    return originalPrice;
  }
  
  const discountAmount = (originalPrice * this.discountPercentage) / 100;
  return Math.round((originalPrice - discountAmount) * 100) / 100; 
};


categoryOfferSchema.statics.findActiveOfferForCategory = async function(categoryId, date = new Date()) {
  return await this.findOne({
    category: categoryId,
    isActive: true,
    startDate: { $lte: date },
    endDate: { $gte: date }
  }).sort({ discountPercentage: -1 }); 
};


categoryOfferSchema.statics.hasOverlappingOffer = async function(categoryId, startDate, endDate, excludeOfferId = null) {
  const query = {
    category: categoryId,
    isActive: true,
    $or: [
     
      { startDate: { $lte: startDate }, endDate: { $gte: startDate } },
     
      { startDate: { $lte: endDate }, endDate: { $gte: endDate } },
  
      { startDate: { $gte: startDate }, endDate: { $lte: endDate } }
    ]
  };

  if (excludeOfferId) {
    query._id = { $ne: excludeOfferId };
  }

  const overlappingOffer = await this.findOne(query);
  return !!overlappingOffer;
};

categoryOfferSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('startDate') || this.isModified('endDate') || this.isModified('category')) {
    const hasOverlap = await this.constructor.hasOverlappingOffer(
      this.category,
      this.startDate,
      this.endDate,
      this._id
    );

    if (hasOverlap) {
      const error = new Error('An active offer already exists for this category during the specified period');
      error.name = 'ValidationError';
      return next(error);
    }
  }
  next();
});


categoryOfferSchema.statics.disableExpiredOffers = async function() {
  const now = new Date();
  const result = await this.updateMany(
    {
      isActive: true,
      endDate: { $lt: now }
    },
    {
      $set: { isActive: false }
    }
  );
  
  return result.modifiedCount;
};

export const CategoryOffer = mongoose.model("CategoryOffer", categoryOfferSchema);