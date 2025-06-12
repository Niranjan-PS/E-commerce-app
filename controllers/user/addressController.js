import { Address } from "../../model/addressModel.js";
import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";


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


const validateAddressField = (value, fieldName, isRequired = true) => {
  if (!value || value.trim().length === 0) {
    if (isRequired) {
      return `${fieldName} is required`;
    }
    return null;
  }

  const trimmedValue = value.trim();

  
  if (trimmedValue.length === 0) {
    return `${fieldName} cannot be only spaces`;
  }

 
  if (trimmedValue.includes('_')) {
    return `${fieldName} cannot contain underscores`;
  }


  if (['title', 'fullName', 'city', 'state', 'country'].includes(fieldName.toLowerCase().replace(' ', ''))) {
   
    if (/^\d+$/.test(trimmedValue)) {
      return `${fieldName} cannot be only numbers`;
    }

   
    if (!/[a-zA-Z]/.test(trimmedValue)) {
      return `${fieldName} must contain at least one letter`;
    }

    
    if (['fullName', 'city', 'state', 'country'].includes(fieldName.toLowerCase().replace(' ', ''))) {
      if (!/^[a-zA-Z\s.-]+$/.test(trimmedValue)) {
        return `${fieldName} can only contain letters, spaces, dots, and hyphens`;
      }
    }
  }

  
  if (['street', 'landmark'].includes(fieldName.toLowerCase())) {
    if (!/[a-zA-Z]/.test(trimmedValue)) {
      return `${fieldName} must contain at least one letter`;
    }
  }

  return null; 
};

export const addAddress = catchAsyncError(async (req, res, next) => {
  try {
    
    
    console.log('Request body:', req.body);
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

    console.log('Extracted fields:', {
      title, fullName, phone, street, landmark, city, state, zipCode, country, addressType, isDefault
    });

    
    const validationErrors = [];

    
    const requiredFields = [
      { value: title, name: 'Address Title' },
      { value: fullName, name: 'Full Name' },
      { value: phone, name: 'Phone' },
      { value: street, name: 'Street' },
      { value: city, name: 'City' },
      { value: state, name: 'State' },
      { value: zipCode, name: 'ZIP Code' }
    ];

    for (const field of requiredFields) {
      if (!field.value || field.value.trim().length === 0) {
        validationErrors.push(`${field.name} is required`);
      } else {
        const error = validateAddressField(field.value, field.name, true);
        if (error) {
          validationErrors.push(error);
        }
      }
    }

    
    if (landmark) {
      const landmarkError = validateAddressField(landmark, 'Landmark', false);
      if (landmarkError) {
        validationErrors.push(landmarkError);
      }
    }

    if (country) {
      const countryError = validateAddressField(country, 'Country', false);
      if (countryError) {
        validationErrors.push(countryError);
      }
    }

    console.log('Validation errors found:', validationErrors);

    if (validationErrors.length > 0) {
      console.log('Returning validation error:', validationErrors[0]);
      return res.status(400).json({
        success: false,
        message: validationErrors[0] 
      });
    }

    const phoneRegex = /^\+91\d{10}$/;
    if (!phoneRegex.test(phone.trim())) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid phone number format. Use +91XXXXXXXXXX'
      });
    }

    const zipRegex = /^\d{6}$/;
    if (!zipRegex.test(zipCode.trim())) {
      return res.status(400).json({ 
        success: false,
        message: 'ZIP code must be 6 digits'
      });
    }

    
    const existingAddresses = await Address.find({ user: req.user._id, isActive: true });
    

    const shouldBeDefault = existingAddresses.length === 0 || isDefault === 'on';
  

    const addressData = {
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
    };

    console.log('Creating address with data:', addressData);
    const newAddress = new Address(addressData);

    console.log('Saving address to database...');
    await newAddress.save();
    console.log('Address saved successfully:', newAddress._id);

    
    return res.status(201).json({
      success: true,
      message: 'Address added successfully!',
      address: newAddress
    });

  } catch (error) {
    console.error("Error adding address:", error);
    if (error.name === 'ValidationError') {
      const errorMessage = Object.values(error.errors)[0].message;
      return res.status(400).json({ 
        success: false,
        message: errorMessage
      });
    }
   
    return res.status(500).json({ 
      success: false,
      message: 'Failed to add this address due to a server error.'
    });
  }
});


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
    console.error("Error loading edit :", error);
    return res.redirect('/addresses?error=Failed to load address');
  }
});


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

    const validationErrors = [];

    
    const requiredFields = [
      { value: title, name: 'Address Title' },
      { value: fullName, name: 'Full Name' },
      { value: phone, name: 'Phone' },
      { value: street, name: 'Street' },
      { value: city, name: 'City' },
      { value: state, name: 'State' },
      { value: zipCode, name: 'ZIP Code' }
    ];

    for (const field of requiredFields) {
      if (!field.value || field.value.trim().length === 0) {
        validationErrors.push(`${field.name} is required`);
      } else {
        const error = validateAddressField(field.value, field.name, true);
        if (error) {
          validationErrors.push(error);
        }
      }
    }

   
    if (landmark) {
      const landmarkError = validateAddressField(landmark, 'Landmark', false);
      if (landmarkError) {
        validationErrors.push(landmarkError);
      }
    }

    if (country) {
      const countryError = validateAddressField(country, 'Country', false);
      if (countryError) {
        validationErrors.push(countryError);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: validationErrors[0]
      });
    }


    const phoneRegex = /^\+91\d{10}$/;
    if (!phoneRegex.test(phone.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Use +91XXXXXXXXXX'
      });
    }


    const zipRegex = /^\d{6}$/;
    if (!zipRegex.test(zipCode.trim())) {
      return res.status(400).json({
        success: false,
        message: 'ZIP code must be 6 digits'
      });
    }

    
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

    res.status(200).json({
      success: true,
      message: 'Address updated successfully'
    });
  } catch (error) {
    console.error("Error updating address:", error);
    if (error.name === 'ValidationError') {
      const errorMessage = Object.values(error.errors)[0].message;
      return res.status(400).json({
        success: false,
        message: errorMessage
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update address due to a server error'
    });
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

    
    if (address.isDefault) {
      
      const otherAddresses = await Address.find({ 
        user: req.user._id, 
        _id: { $ne: id }, 
        isActive: true 
      });

      if (otherAddresses.length > 0) {
        
        await Address.findByIdAndUpdate(otherAddresses[0]._id, { isDefault: true });
      }
    }

    
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
