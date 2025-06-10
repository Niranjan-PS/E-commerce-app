import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  productImage: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  originalQuantity: {
    type: Number,
    required: true,
    min: 1
  },
  cancelledQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  returnedQuantity: {
    type: Number,
    default: 0,
    min: 0
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
    default: 0
  },
  itemTotal: {
    type: Number,
    required: true
  },
  itemStatus: {
    type: String,
    enum: ['Active', 'Cancelled', 'Returned', 'Partially Cancelled', 'Partially Returned'],
    default: 'Active'
  }
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  items: [orderItemSchema],

  
  shippingAddress: {
    fullName: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    street: {
      type: String,
      required: true
    },
    landmark: {
      type: String,
      default: ""
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    addressType: {
      type: String,
      enum: ['Home', 'Work', 'Other'],
      default: 'Home'
    }
  },

  
  subtotal: {
    type: Number,
    required: true
  },
  productSavings: {
    type: Number,
    default: 0
  },
  couponDiscount: {
    type: Number,
    default: 0
  },
  couponCode: {
    type: String,
    default: null
  },
  tax: {
    type: Number,
    required: true
  },
  taxRate: {
    type: Number,
    required: true
  },
  shipping: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },

 
  paymentMethod: {
    type: String,
    enum: ['COD', 'Online', 'Wallet'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
    default: 'Pending'
  },

 
  orderStatus: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],
    default: 'Pending'
  },

  
  orderDate: {
    type: Date,
    default: Date.now
  },
  expectedDelivery: {
    type: Date,
    default: function() {
      
      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() + 7);
      return deliveryDate;
    }
  },
  deliveredAt: {
    type: Date,
    default: null
  },

 
  notes: {
    type: String,
    default: ""
  },

 
  trackingNumber: {
    type: String,
    default: null
  },

 
  cancellationReason: {
    type: String,
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },

  // Return Information
  returnReason: {
    type: String,
    default: null
  },
  returnRequestedAt: {
    type: Date,
    default: null
  },
  returnApprovedAt: {
    type: Date,
    default: null
  },
  returnCompletedAt: {
    type: Date,
    default: null
  },
  returnRejectedAt: {
    type: Date,
    default: null
  },
  returnStatus: {
    type: String,
    enum: ['None', 'Requested', 'Approved', 'Rejected', 'Completed'],
    default: 'None'
  },
  adminReturnNotes: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Generate order number
orderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const timestamp = Date.now().toString();
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.orderNumber = `ORD${timestamp}${randomNum}`;
  }
  next();
});

// Instance methods
orderSchema.methods.canBeCancelled = function() {
  return ['Pending', 'Confirmed'].includes(this.orderStatus);
};

orderSchema.methods.canBeReturned = function() {
  return this.orderStatus === 'Delivered' &&
         this.deliveredAt &&
         (Date.now() - this.deliveredAt.getTime()) <= (7 * 24 * 60 * 60 * 1000) && 
         this.returnStatus === 'None'; 
};

orderSchema.methods.canRequestReturn = function() {
  return this.orderStatus === 'Delivered' &&
         this.deliveredAt &&
         (Date.now() - this.deliveredAt.getTime()) <= (7 * 24 * 60 * 60 * 1000) && 
         ['None', 'Rejected'].includes(this.returnStatus); 
};

orderSchema.methods.updateStatus = function(newStatus) {
  this.orderStatus = newStatus;

  if (newStatus === 'Delivered') {
    this.deliveredAt = new Date();
    this.paymentStatus = 'Paid';
  }

  if (newStatus === 'Cancelled') {
    this.cancelledAt = new Date();
  }

  return this.save();
};

// Static methods
orderSchema.statics.generateOrderNumber = function() {
  const timestamp = Date.now().toString();
  const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${timestamp}${randomNum}`;
};

orderSchema.statics.getOrdersByUser = function(userId, options = {}) {
  const { page = 1, limit = 10, status } = options;
  const skip = (page - 1) * limit;

  let query = { user: userId };
  if (status) {
    query.orderStatus = status;
  }

  return this.find(query)
    .populate('items.product')
    .sort({ orderDate: -1 })
    .skip(skip)
    .limit(limit);
};

orderSchema.statics.getOrderStats = function(userId) {
  return this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$orderStatus',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' }
      }
    }
  ]);
};

// Search orders by order number or product name
orderSchema.statics.searchOrders = function(userId, searchQuery, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  const searchRegex = new RegExp(searchQuery, 'i');

  return this.find({
    user: userId,
    $or: [
      { orderNumber: searchRegex },
      { 'items.productName': searchRegex }
    ]
  })
  .populate('items.product')
  .sort({ orderDate: -1 })
  .skip(skip)
  .limit(limit);
};

// Indexes for better performance
orderSchema.index({ user: 1, orderDate: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ paymentStatus: 1 });

export const Order = mongoose.model("Order", orderSchema);
