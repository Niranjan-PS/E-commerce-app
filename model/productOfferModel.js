import mongoose from "mongoose";

const productOfferSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
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


productOfferSchema.index({ product: 1, startDate: 1, endDate: 1 });
productOfferSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

productOfferSchema.virtual('isCurrentlyValid').get(function() {
  const now = new Date();
  return this.isActive && 
         now >= this.startDate && 
         now <= this.endDate;
});


productOfferSchema.methods.isValidAt = function(date = new Date()) {
  return this.isActive && 
         date >= this.startDate && 
         date <= this.endDate;
};


productOfferSchema.methods.calculateDiscountedPrice = function(originalPrice) {

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


productOfferSchema.statics.findActiveOfferForProduct = async function(productId, date = new Date()) {
  return await this.findOne({
    product: productId,
    isActive: true,
    startDate: { $lte: date },
    endDate: { $gte: date }
  }).sort({ discountPercentage: -1 }); 
};


productOfferSchema.statics.hasOverlappingOffer = async function(productId, startDate, endDate, excludeOfferId = null) {
  const query = {
    product: productId,
    isActive: true,
    $or: [
      // New offer starts during existing offer
      { startDate: { $lte: startDate }, endDate: { $gte: startDate } },
      // New offer ends during existing offer
      { startDate: { $lte: endDate }, endDate: { $gte: endDate } },
      // New offer completely contains existing offer
      { startDate: { $gte: startDate }, endDate: { $lte: endDate } }
    ]
  };

  if (excludeOfferId) {
    query._id = { $ne: excludeOfferId };
  }

  const overlappingOffer = await this.findOne(query);
  return !!overlappingOffer;
};


productOfferSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('startDate') || this.isModified('endDate') || this.isModified('product')) {
    const hasOverlap = await this.constructor.hasOverlappingOffer(
      this.product,
      this.startDate,
      this.endDate,
      this._id
    );

    if (hasOverlap) {
      const error = new Error('An active offer already exists for this product during the specified period');
      error.name = 'ValidationError';
      return next(error);
    }
  }
  next();
});


productOfferSchema.statics.disableExpiredOffers = async function() {
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

export const ProductOffer = mongoose.model("ProductOffer", productOfferSchema);