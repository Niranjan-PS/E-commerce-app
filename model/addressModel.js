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
    maxLength: [50, "Address title cannot exceed 50 characters"],
    validate: {
      validator: function(v) {
        
        if (!v || v.trim().length === 0) {
          return false;
        }
        
        if (v.includes('_')) {
          return false;
        }
        
        if (/^\d+$/.test(v.trim())) {
          return false;
        }
        
        if (!/[a-zA-Z]/.test(v)) {
          return false;
        }
        return true;
      },
      message: "Address title must contain at least one letter, cannot be only spaces, numbers, or contain underscores"
    }
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
    maxLength: [100, "Full name cannot exceed 100 characters"],
    validate: {
      validator: function(v) {
      
        if (!v || v.trim().length === 0) {
          return false;
        }
       
        if (v.includes('_')) {
          return false;
        }
       
        if (/^\d+$/.test(v.trim())) {
          return false;
        }
        
        if (!/[a-zA-Z]/.test(v)) {
          return false;
        }
        
        if (!/^[a-zA-Z\s.-]+$/.test(v.trim())) {
          return false;
        }
        return true;
      },
      message: "Full name must contain only letters, spaces, dots, and hyphens. Cannot be only spaces, numbers, or contain underscores"
    }
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
    maxLength: [200, "Street address cannot exceed 200 characters"],
    validate: {
      validator: function(v) {
        
        if (!v || v.trim().length === 0) {
          return false;
        }
        
        if (v.includes('_')) {
          return false;
        }
        
        if (!/[a-zA-Z]/.test(v)) {
          return false;
        }
        return true;
      },
      message: "Street address must contain at least one letter, cannot be only spaces or contain underscores"
    }
  },
  landmark: {
    type: String,
    trim: true,
    maxLength: [100, "Landmark cannot exceed 100 characters"],
    default: null,
    validate: {
      validator: function(v) {
        
        if (!v || v.trim().length === 0) {
          return true;
        }
        
        if (v.includes('_')) {
          return false;
        }
        
        if (!/[a-zA-Z]/.test(v)) {
          return false;
        }
        return true;
      },
      message: "Landmark must contain at least one letter and cannot contain underscores"
    }
  },
  city: {
    type: String,
    required: true,
    trim: true,
    maxLength: [50, "City name cannot exceed 50 characters"],
    validate: {
      validator: function(v) {
       
        if (!v || v.trim().length === 0) {
          return false;
        }
        
        if (v.includes('_')) {
          return false;
        }
        
        if (/^\d+$/.test(v.trim())) {
          return false;
        }
        
        if (!/[a-zA-Z]/.test(v)) {
          return false;
        }
        
        if (!/^[a-zA-Z\s.-]+$/.test(v.trim())) {
          return false;
        }
        return true;
      },
      message: "City name must contain only letters, spaces, dots, and hyphens. Cannot be only spaces, numbers, or contain underscores"
    }
  },
  state: {
    type: String,
    required: true,
    trim: true,
    maxLength: [50, "State name cannot exceed 50 characters"],
    validate: {
      validator: function(v) {
        
        if (!v || v.trim().length === 0) {
          return false;
        }
        
        if (v.includes('_')) {
          return false;
        }
       
        if (/^\d+$/.test(v.trim())) {
          return false;
        }
        
        if (!/[a-zA-Z]/.test(v)) {
          return false;
        }
        
        if (!/^[a-zA-Z\s.-]+$/.test(v.trim())) {
          return false;
        }
        return true;
      },
      message: "State name must contain only letters, spaces, dots, and hyphens. Cannot be only spaces, numbers, or contain underscores"
    }
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
    maxLength: [50, "Country name cannot exceed 50 characters"],
    validate: {
      validator: function(v) {
       
        if (!v || v.trim().length === 0) {
          return false;
        }
        
        if (v.includes('_')) {
          return false;
        }
        
        if (/^\d+$/.test(v.trim())) {
          return false;
        }
        
        if (!/[a-zA-Z]/.test(v)) {
          return false;
        }
       
        if (!/^[a-zA-Z\s.-]+$/.test(v.trim())) {
          return false;
        }
        return true;
      },
      message: "Country name must contain only letters, spaces, dots, and hyphens. Cannot be only spaces, numbers, or contain underscores"
    }
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


addressSchema.index({ user: 1, isActive: 1 });
addressSchema.index({ user: 1, isDefault: 1 });


addressSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
   
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});


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


addressSchema.methods.getShortAddress = function() {
  return `${this.street}, ${this.city}, ${this.state} - ${this.zipCode}`;
};


addressSchema.statics.getDefaultAddress = function(userId) {
  return this.findOne({ user: userId, isDefault: true, isActive: true });
};


addressSchema.statics.getUserAddresses = function(userId) {
  return this.find({ user: userId, isActive: true }).sort({ isDefault: -1, createdAt: -1 });
};

export const Address = mongoose.model("Address", addressSchema);
