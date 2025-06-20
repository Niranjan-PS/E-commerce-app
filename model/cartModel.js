import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true
  },
  salePrice: {
    type: Number,
    default: null
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  totalItems: {
    type: Number,
    default: 0
  },
  totalPrice: {
    type: Number,
    default: 0
  },
  totalSalePrice: {
    type: Number,
    default: 0
  },
  totalSavings: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});


cartSchema.index({ user: 1 });
cartSchema.index({ 'items.product': 1 });


export const CART_LIMITS = {
  MAX_QUANTITY_PER_PRODUCT: 10,
  MAX_ITEMS_IN_CART: 50
};


cartSchema.methods.calculateTotals = function() {
  let totalItems = 0;
  let totalPrice = 0;
  let totalSalePrice = 0;

  this.items.forEach(item => {
    totalItems += item.quantity;
    totalPrice += item.price * item.quantity;
    totalSalePrice += (item.salePrice || item.price) * item.quantity;
  });

  this.totalItems = totalItems;
  this.totalPrice = totalPrice;
  this.totalSalePrice = totalSalePrice;
  this.totalSavings = totalPrice - totalSalePrice;
  this.lastUpdated = new Date();

  return {
    totalItems,
    totalPrice,
    totalSalePrice,
    totalSavings: this.totalSavings
  };
};


cartSchema.methods.addItem = function(productData, quantity = 1) {
  const existingItemIndex = this.items.findIndex(
    item => item.product.toString() === productData._id.toString()
  );

  if (existingItemIndex > -1) {
    
    const newQuantity = this.items[existingItemIndex].quantity + quantity;
    
    
    if (newQuantity > CART_LIMITS.MAX_QUANTITY_PER_PRODUCT) {
      throw new Error(`Maximum ${CART_LIMITS.MAX_QUANTITY_PER_PRODUCT} items allowed per product`);
    }
    
    if (newQuantity > productData.quantity) {
      throw new Error(`Only ${productData.quantity} items available in stock`);
    }

    this.items[existingItemIndex].quantity = newQuantity;
    this.items[existingItemIndex].price = productData.price;
    this.items[existingItemIndex].salePrice = productData.salePrice;
  } else {
   
    if (this.items.length >= CART_LIMITS.MAX_ITEMS_IN_CART) {
      throw new Error(`Maximum ${CART_LIMITS.MAX_ITEMS_IN_CART} different items allowed in cart`);
    }

    if (quantity > CART_LIMITS.MAX_QUANTITY_PER_PRODUCT) {
      throw new Error(`Maximum ${CART_LIMITS.MAX_QUANTITY_PER_PRODUCT} items allowed per product`);
    }

    if (quantity > productData.quantity) {
      throw new Error(`Only ${productData.quantity} items available in stock`);
    }

    this.items.push({
      product: productData._id,
      quantity,
      price: productData.price,
      salePrice: productData.salePrice
    });
  }

  this.calculateTotals();
  return this;
};


cartSchema.methods.updateItemQuantity = function(productId, quantity) {
  const itemIndex = this.items.findIndex(
    item => item.product.toString() === productId.toString()
  );

  if (itemIndex === -1) {
    throw new Error('Item not found in cart');
  }

  if (quantity <= 0) {
   
    this.items.splice(itemIndex, 1);
  } else {
    if (quantity > CART_LIMITS.MAX_QUANTITY_PER_PRODUCT) {
      throw new Error(`Maximum ${CART_LIMITS.MAX_QUANTITY_PER_PRODUCT} items allowed per product`);
    }

    this.items[itemIndex].quantity = quantity;
  }

  this.calculateTotals();
  return this;
};


cartSchema.methods.removeItem = function(productId) {
  const itemIndex = this.items.findIndex(
    item => item.product.toString() === productId.toString()
  );

  if (itemIndex > -1) {
    this.items.splice(itemIndex, 1);
    this.calculateTotals();
  }

  return this;
};


cartSchema.methods.clearCart = function() {
  this.items = [];
  this.calculateTotals();
  return this;
};


cartSchema.methods.getItem = function(productId) {
  return this.items.find(
    item => item.product.toString() === productId.toString()
  );
};


cartSchema.methods.hasProduct = function(productId) {
  return this.items.some(
    item => item.product.toString() === productId.toString()
  );
};


cartSchema.statics.getOrCreateCart = async function(userId) {
  let cart = await this.findOne({ user: userId }).populate({
    path: 'items.product',
    populate: {
      path: 'category'
    }
  });

  if (!cart) {
    cart = new this({ user: userId });
    await cart.save();
  }

  return cart;
};


cartSchema.pre('save', function(next) {
  if (this.isModified('items')) {
    this.calculateTotals();
  }
  next();
});

export const Cart = mongoose.model("Cart", cartSchema);
