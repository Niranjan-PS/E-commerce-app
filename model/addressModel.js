import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxLength: [50, "Address title cannot exceed 50 characters"]
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
    maxLength: [100, "Full name cannot exceed 100 characters"]
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\+91\d{10}$/.test(v);
      },
      message: "Phone number must be in format +91XXXXXXXXXX"
    }
  },
  street: {
    type: String,
    required: true,
    trim: true,
    maxLength: [200, "Street address cannot exceed 200 characters"]
  },
  landmark: {
    type: String,
    trim: true,
    maxLength: [100, "Landmark cannot exceed 100 characters"],
    default: null
  },
  city: {
    type: String,
    required: true,
    trim: true,
    maxLength: [50, "City name cannot exceed 50 characters"]
  },
  state: {
    type: String,
    required: true,
    trim: true,
    maxLength: [50, "State name cannot exceed 50 characters"]
  },
  zipCode: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{6}$/.test(v);
      },
      message: "ZIP code must be 6 digits"
    }
  },
  country: {
    type: String,
    required: true,
    trim: true,
    default: "India",
    maxLength: [50, "Country name cannot exceed 50 characters"]
  },
  addressType: {
    type: String,
    enum: ['Home', 'Work', 'Other'],
    default: 'Home'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
addressSchema.index({ user: 1, isActive: 1 });
addressSchema.index({ user: 1, isDefault: 1 });

// Ensure only one default address per user
addressSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Remove default flag from other addresses of the same user
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

// Virtual for formatted address
addressSchema.virtual('formattedAddress').get(function() {
  const parts = [
    this.street,
    this.landmark,
    this.city,
    this.state,
    this.zipCode,
    this.country
  ].filter(part => part && part.trim());
  
  return parts.join(', ');
});

// Method to get short address
addressSchema.methods.getShortAddress = function() {
  return `${this.street}, ${this.city}, ${this.state} - ${this.zipCode}`;
};

// Static method to get user's default address
addressSchema.statics.getDefaultAddress = function(userId) {
  return this.findOne({ user: userId, isDefault: true, isActive: true });
};

// Static method to get all active addresses for a user
addressSchema.statics.getUserAddresses = function(userId) {
  return this.find({ user: userId, isActive: true }).sort({ isDefault: -1, createdAt: -1 });
};

export const Address = mongoose.model("Address", addressSchema);
