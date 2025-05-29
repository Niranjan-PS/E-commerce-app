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
  reviewCount: {
    type: Number,
    default: 0
  },
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
  return this.find({ isDeleted: true }).populate('category');
};

// Static method to find a product by ID including soft-deleted ones
productSchema.statics.findByIdWithDeleted = async function(productId) {
  return this.findOne({ _id: productId }).where({ isDeleted: { $exists: true } });
};

// Query middleware to exclude soft-deleted products by default
productSchema.pre('find', function() {
  this.where({ isDeleted: { $ne: true } });
});

productSchema.pre('findOne', function() {
  this.where({ isDeleted: { $ne: true } });
});

productSchema.pre('countDocuments', function() {
  this.where({ isDeleted: { $ne: true } });
});

export const Product = model('Product', productSchema);