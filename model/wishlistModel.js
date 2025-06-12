import mongoose from "mongoose";

const wishlistItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const wishlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [wishlistItemSchema],
  totalItems: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});


wishlistSchema.index({ user: 1 });
wishlistSchema.index({ 'items.product': 1 });


wishlistSchema.methods.addItem = function(productId) {
  const existingItem = this.items.find(
    item => item.product.toString() === productId.toString()
  );

  if (!existingItem) {
    this.items.push({ product: productId });
    this.totalItems = this.items.length;
  }

  return this;
};


wishlistSchema.methods.removeItem = function(productId) {
  const itemIndex = this.items.findIndex(
    item => item.product.toString() === productId.toString()
  );

  if (itemIndex > -1) {
    this.items.splice(itemIndex, 1);
    this.totalItems = this.items.length;
  }

  return this;
};


wishlistSchema.methods.hasProduct = function(productId) {
  return this.items.some(
    item => item.product.toString() === productId.toString()
  );
};


wishlistSchema.methods.clearWishlist = function() {
  this.items = [];
  this.totalItems = 0;
  return this;
};


wishlistSchema.statics.getOrCreateWishlist = async function(userId) {
  let wishlist = await this.findOne({ user: userId }).populate({
    path: 'items.product',
    populate: {
      path: 'category'
    }
  });

  if (!wishlist) {
    wishlist = new this({ user: userId });
    await wishlist.save();
  }

  return wishlist;
};

export const Wishlist = mongoose.model("Wishlist", wishlistSchema);
