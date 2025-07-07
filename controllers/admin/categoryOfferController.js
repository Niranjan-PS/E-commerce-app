import { catchAsyncError } from "../../middlewares/catchAsync.js";
import ErrorHandler from "../../middlewares/error.js";
import { CategoryOffer } from "../../model/categoryOfferModel.js";
import { Category } from "../../model/categoryModel.js";


export const getCategoryOffers = catchAsyncError(async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';

    
    await CategoryOffer.disableExpiredOffers();

    let query = {};

    if (search) {
      
      const categories = await Category.find({
        name: new RegExp(search, 'i')
      });
      
      query = {
        $or: [
          { offerName: new RegExp(search, 'i') },
          { category: { $in: categories.map(c => c._id) } }
        ]
      };
    }

   
    const now = new Date();
    if (status === 'active') {
      query.isActive = true;
      query.startDate = { $lte: now };
      query.endDate = { $gte: now };
    } else if (status === 'upcoming') {
      query.isActive = true;
      query.startDate = { $gt: now };
    } else if (status === 'expired') {
      query.endDate = { $lt: now };
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    const offers = await CategoryOffer.find(query)
      .populate('category', 'name description')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalOffers = await CategoryOffer.countDocuments(query);
    const totalPages = Math.ceil(totalOffers / limit);

    const stats = {
      total: await CategoryOffer.countDocuments(),
      active: await CategoryOffer.countDocuments({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
      }),
      upcoming: await CategoryOffer.countDocuments({
        isActive: true,
        startDate: { $gt: now }
      }),
      expired: await CategoryOffer.countDocuments({
        endDate: { $lt: now }
      })
    };

    res.render("admin/category-offers", {
      offers,
      currentPage: page,
      totalPages,
      totalOffers,
      search,
      status,
      stats,
      message: req.query.message,
      error: req.query.error
    });
  } catch (error) {
    console.error("Error loading category offers:", error);
    return next(new ErrorHandler("Failed to load category offers", 500));
  }
});


export const getAddCategoryOffer = catchAsyncError(async (req, res, next) => {
  try {
    const categories = await Category.find({ isListed: true }).sort({ name: 1 });

    res.render("admin/add-category-offer", {
      categories,
      message: req.query.message,
      error: req.query.error
    });
  } catch (error) {
    console.error("Error loading add category offer page:", error);
    return next(new ErrorHandler("Failed to load add category offer page", 500));
  }
});


export const createCategoryOffer = catchAsyncError(async (req, res, next) => {
  try {
    const {
      category,
      offerName,
      discountPercentage,
      startDate,
      endDate,
      description
    } = req.body;

    console.log('Creating category offer with data:', req.body);

   
    if (!category || !offerName || !discountPercentage || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    const discount = parseFloat(discountPercentage);
    if (isNaN(discount) || discount < 1 || discount > 90) {
      return res.status(400).json({
        success: false,
        message: 'Discount percentage must be between 1% and 90%'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: 'Selected category does not exist'
      });
    }

   
    const hasOverlap = await CategoryOffer.hasOverlappingOffer(category, start, end);
    if (hasOverlap) {
      return res.status(400).json({
        success: false,
        message: 'An active offer already exists for this category during the specified period'
      });
    }

   
    const offer = new CategoryOffer({
      category,
      offerName: offerName.trim(),
      discountPercentage: discount,
      startDate: start,
      endDate: end,
      description: description ? description.trim() : '',
      isActive: true
    });

    await offer.save();

    console.log('Category offer created successfully:', {
      id: offer._id,
      offerName: offer.offerName,
      category: offer.category,
      discountPercentage: offer.discountPercentage
    });

    res.status(201).json({
      success: true,
      message: 'Category offer created successfully',
      offer
    });
  } catch (error) {
    console.error("Error creating category offer:", error);

    res.status(500).json({
      success: false,
      message: 'Failed to create category offer'
    });
  }
});


export const getEditCategoryOffer = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;

    const offer = await CategoryOffer.findById(id).populate('category');
    if (!offer) {
      return res.redirect('/admin/category-offers?error=Category offer not found');
    }

    const categories = await Category.find({ isListed: true }).sort({ name: 1 });

    res.render("admin/edit-category-offer", {
      offer,
      categories,
      message: req.query.message,
      error: req.query.error
    });
  } catch (error) {
    console.error("Error loading edit category offer page:", error);
    return res.redirect('/admin/category-offers?error=Failed to load category offer');
  }
});


export const updateCategoryOffer = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      category,
      offerName,
      discountPercentage,
      startDate,
      endDate,
      description,
      isActive
    } = req.body;

    const offer = await CategoryOffer.findById(id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Category offer not found'
      });
    }

   
    if (!category || !offerName || !discountPercentage || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    const discount = parseFloat(discountPercentage);
    if (isNaN(discount) || discount < 1 || discount > 90) {
      return res.status(400).json({
        success: false,
        message: 'Discount percentage must be between 1% and 90%'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

   
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: 'Selected category does not exist'
      });
    }

   
    if (category !== offer.category.toString() ||
        start.getTime() !== offer.startDate.getTime() ||
        end.getTime() !== offer.endDate.getTime()) {

      const hasOverlap = await CategoryOffer.hasOverlappingOffer(category, start, end, id);
      if (hasOverlap) {
        return res.status(400).json({
          success: false,
          message: 'An active offer already exists for this category during the specified period'
        });
      }
    }

   
    offer.category = category;
    offer.offerName = offerName.trim();
    offer.discountPercentage = discount;
    offer.startDate = start;
    offer.endDate = end;
    offer.description = description ? description.trim() : '';
    offer.isActive = isActive === 'true';

    await offer.save();

    res.status(200).json({
      success: true,
      message: 'Category offer updated successfully',
      offer
    });
  } catch (error) {
    console.error("Error updating category offer:", error);

    res.status(500).json({
      success: false,
      message: 'Failed to update category offer'
    });
  }
});


export const deleteCategoryOffer = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;

    const offer = await CategoryOffer.findById(id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Category offer not found'
      });
    }

    await CategoryOffer.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Category offer deleted successfully'
    });
  } catch (error) {
    console.error("Error deleting category offer:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete category offer'
    });
  }
});


export const toggleCategoryOfferStatus = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;

    const offer = await CategoryOffer.findById(id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Category offer not found'
      });
    }

    offer.isActive = !offer.isActive;
    await offer.save();

    res.status(200).json({
      success: true,
      message: `Category offer ${offer.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: offer.isActive
    });
  } catch (error) {
    console.error("Error toggling category offer status:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update category offer status'
    });
  }
});


export const getCategoryOfferDetails = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;

    const offer = await CategoryOffer.findById(id)
      .populate('category', 'name description');

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Category offer not found'
      });
    }

    res.status(200).json({
      success: true,
      offer
    });
  } catch (error) {
    console.error("Error getting category offer details:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get category offer details'
    });
  }
});


export const checkCategoryAvailability = catchAsyncError(async (req, res, next) => {
  try {
    const { categoryId, startDate, endDate, excludeOfferId } = req.query;

    const start = new Date(startDate);
    const end = new Date(endDate);

    const hasOverlap = await CategoryOffer.hasOverlappingOffer(
      categoryId,
      start,
      end,
      excludeOfferId
    );

    res.status(200).json({
      available: !hasOverlap,
      message: hasOverlap ? 'Category has overlapping offer in this period' : 'Category is available for offer'
    });
  } catch (error) {
    console.error("Error checking category availability:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check category availability'
    });
  }
});