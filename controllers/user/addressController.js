import { Address } from "../../model/addressModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";

// Get all addresses for a user
export const getAddresses = catchAsyncError(async (req, res, next) => {
  try {
    const addresses = await Address.getUserAddresses(req.user._id);
    
    res.render("user/addresses", {
      addresses,
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading addresses:", error);
    return next(new ErrorHandler("Failed to load addresses", 500));
  }
});

// Load add address page
export const loadAddAddress = catchAsyncError(async (req, res, next) => {
  try {
    res.render("user/add-address", {
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading add address page:", error);
    return next(new ErrorHandler("Failed to load add address page", 500));
  }
});

// Add new address
export const addAddress = catchAsyncError(async (req, res, next) => {
  try {
    const {
      title,
      fullName,
      phone,
      street,
      landmark,
      city,
      state,
      zipCode,
      country,
      addressType,
      isDefault
    } = req.body;

    // Validate required fields
    if (!title || !fullName || !phone || !street || !city || !state || !zipCode) {
      return res.redirect('/addresses/add?error=All required fields must be filled');
    }

    // Validate phone number
    const phoneRegex = /^\+91\d{10}$/;
    if (!phoneRegex.test(phone.trim())) {
      return res.redirect('/addresses/add?error=Invalid phone number format. Use +91XXXXXXXXXX');
    }

    // Validate ZIP code
    const zipRegex = /^\d{6}$/;
    if (!zipRegex.test(zipCode.trim())) {
      return res.redirect('/addresses/add?error=ZIP code must be 6 digits');
    }

    // Check if this is the user's first address
    const existingAddresses = await Address.find({ user: req.user._id, isActive: true });
    const shouldBeDefault = existingAddresses.length === 0 || isDefault === 'on';

    const newAddress = new Address({
      user: req.user._id,
      title: title.trim(),
      fullName: fullName.trim(),
      phone: phone.trim(),
      street: street.trim(),
      landmark: landmark ? landmark.trim() : null,
      city: city.trim(),
      state: state.trim(),
      zipCode: zipCode.trim(),
      country: country ? country.trim() : 'India',
      addressType: addressType || 'Home',
      isDefault: shouldBeDefault
    });

    await newAddress.save();

    res.redirect('/addresses?message=Address added successfully');
  } catch (error) {
    console.error("Error adding address:", error);
    if (error.name === 'ValidationError') {
      const errorMessage = Object.values(error.errors)[0].message;
      return res.redirect(`/addresses/add?error=${errorMessage}`);
    }
    return res.redirect('/addresses/add?error=Failed to add address');
  }
});

// Load edit address page
export const loadEditAddress = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;
    const address = await Address.findOne({ 
      _id: id, 
      user: req.user._id, 
      isActive: true 
    });

    if (!address) {
      return res.redirect('/addresses?error=Address not found');
    }

    res.render("user/edit-address", {
      address,
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error("Error loading edit address page:", error);
    return res.redirect('/addresses?error=Failed to load address');
  }
});

// Update address
export const updateAddress = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      fullName,
      phone,
      street,
      landmark,
      city,
      state,
      zipCode,
      country,
      addressType,
      isDefault
    } = req.body;

    const address = await Address.findOne({ 
      _id: id, 
      user: req.user._id, 
      isActive: true 
    });

    if (!address) {
      return res.redirect('/addresses?error=Address not found');
    }

    // Validate required fields
    if (!title || !fullName || !phone || !street || !city || !state || !zipCode) {
      return res.redirect(`/addresses/edit/${id}?error=All required fields must be filled`);
    }

    // Validate phone number
    const phoneRegex = /^\+91\d{10}$/;
    if (!phoneRegex.test(phone.trim())) {
      return res.redirect(`/addresses/edit/${id}?error=Invalid phone number format. Use +91XXXXXXXXXX`);
    }

    // Validate ZIP code
    const zipRegex = /^\d{6}$/;
    if (!zipRegex.test(zipCode.trim())) {
      return res.redirect(`/addresses/edit/${id}?error=ZIP code must be 6 digits`);
    }

    // Update address fields
    address.title = title.trim();
    address.fullName = fullName.trim();
    address.phone = phone.trim();
    address.street = street.trim();
    address.landmark = landmark ? landmark.trim() : null;
    address.city = city.trim();
    address.state = state.trim();
    address.zipCode = zipCode.trim();
    address.country = country ? country.trim() : 'India';
    address.addressType = addressType || 'Home';
    address.isDefault = isDefault === 'on';

    await address.save();

    res.redirect('/addresses?message=Address updated successfully');
  } catch (error) {
    console.error("Error updating address:", error);
    if (error.name === 'ValidationError') {
      const errorMessage = Object.values(error.errors)[0].message;
      return res.redirect(`/addresses/edit/${req.params.id}?error=${errorMessage}`);
    }
    return res.redirect(`/addresses/edit/${req.params.id}?error=Failed to update address`);
  }
});

// Delete address
export const deleteAddress = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;
    const address = await Address.findOne({ 
      _id: id, 
      user: req.user._id, 
      isActive: true 
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Check if this is the default address
    if (address.isDefault) {
      // Check if there are other addresses
      const otherAddresses = await Address.find({ 
        user: req.user._id, 
        _id: { $ne: id }, 
        isActive: true 
      });

      if (otherAddresses.length > 0) {
        // Make the first other address default
        await Address.findByIdAndUpdate(otherAddresses[0]._id, { isDefault: true });
      }
    }

    // Soft delete the address
    address.isActive = false;
    await address.save();

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    console.error("Error deleting address:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete address'
    });
  }
});

// Set default address
export const setDefaultAddress = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;
    const address = await Address.findOne({ 
      _id: id, 
      user: req.user._id, 
      isActive: true 
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Set this address as default
    address.isDefault = true;
    await address.save();

    res.status(200).json({
      success: true,
      message: 'Default address updated successfully'
    });
  } catch (error) {
    console.error("Error setting default address:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update default address'
    });
  }
});

// Get addresses for checkout (API endpoint)
export const getAddressesForCheckout = catchAsyncError(async (req, res, next) => {
  try {
    const addresses = await Address.getUserAddresses(req.user._id);
    
    res.status(200).json({
      success: true,
      addresses: addresses.map(addr => ({
        _id: addr._id,
        title: addr.title,
        fullName: addr.fullName,
        phone: addr.phone,
        formattedAddress: addr.getShortAddress(),
        isDefault: addr.isDefault,
        addressType: addr.addressType
      }))
    });
  } catch (error) {
    console.error("Error getting addresses for checkout:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load addresses'
    });
  }
});
