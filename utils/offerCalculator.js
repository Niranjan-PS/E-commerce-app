import { ProductOffer } from "../model/productOfferModel.js";
import { CategoryOffer } from "../model/categoryOfferModel.js";


export const calculateBestOfferPrice = async (product, date = new Date()) => {
  try {
    const originalPrice = product.price;
    let bestOffer = null;
    let bestDiscountPercentage = 0;
    let offerType = null;

    const availableOffers = {
      productOffer: null,
      categoryOffer: null
    };

   
    const productOffer = await ProductOffer.findActiveOfferForProduct(product._id, date);
    if (productOffer) {
      availableOffers.productOffer = {
        id: productOffer._id,
        name: productOffer.offerName,
        discountPercentage: productOffer.discountPercentage,
        type: 'product',
        startDate: productOffer.startDate,
        endDate: productOffer.endDate
      };

      if (productOffer.discountPercentage > bestDiscountPercentage) {
        bestOffer = productOffer;
        bestDiscountPercentage = productOffer.discountPercentage;
        offerType = 'product';
      }
    }

   
    if (product.category && product.category._id) {
      const categoryOffer = await CategoryOffer.findActiveOfferForCategory(product.category._id, date);
      if (categoryOffer) {
        availableOffers.categoryOffer = {
          id: categoryOffer._id,
          name: categoryOffer.offerName,
          discountPercentage: categoryOffer.discountPercentage,
          type: 'category',
          startDate: categoryOffer.startDate,
          endDate: categoryOffer.endDate
        };

        if (categoryOffer.discountPercentage > bestDiscountPercentage) {
          bestOffer = categoryOffer;
          bestDiscountPercentage = categoryOffer.discountPercentage;
          offerType = 'category';
        }
      }
    }

   
    let discountedPrice = originalPrice;
    let savings = 0;
    let offerDetails = null;
    let appliedOfferInfo = null;

    if (bestOffer && bestDiscountPercentage > 0) {
      const discountAmount = (originalPrice * bestDiscountPercentage) / 100;
      discountedPrice = Math.round((originalPrice - discountAmount) * 100) / 100;
      savings = Math.round((originalPrice - discountedPrice) * 100) / 100;
      
      offerDetails = {
        id: bestOffer._id,
        name: bestOffer.offerName,
        discountPercentage: bestDiscountPercentage,
        type: offerType,
        startDate: bestOffer.startDate,
        endDate: bestOffer.endDate
      };

      
      appliedOfferInfo = {
        appliedOffer: offerDetails,
        availableOffers: availableOffers,
        offerComparison: {
          productOfferPercentage: availableOffers.productOffer?.discountPercentage || 0,
          categoryOfferPercentage: availableOffers.categoryOffer?.discountPercentage || 0,
          appliedOfferType: offerType,
          appliedOfferPercentage: bestDiscountPercentage,
          reason: availableOffers.productOffer && availableOffers.categoryOffer 
            ? `Applied ${offerType} offer (${bestDiscountPercentage}%) as it's higher than ${offerType === 'product' ? 'category' : 'product'} offer (${offerType === 'product' ? availableOffers.categoryOffer.discountPercentage : availableOffers.productOffer.discountPercentage}%)`
            : `Applied ${offerType} offer (${bestDiscountPercentage}%)`
        }
      };
    }

    return {
      originalPrice,
      discountedPrice,
      savings,
      hasOffer: !!bestOffer,
      offerDetails,
      appliedOfferInfo,
      availableOffers
    };

  } catch (error) {
    console.error('Error calculating best offer price:', error);
   
    return {
      originalPrice: product.price,
      discountedPrice: product.price,
      savings: 0,
      hasOffer: false,
      offerDetails: null,
      appliedOfferInfo: null,
      availableOffers: { productOffer: null, categoryOffer: null }
    };
  }
};


export const calculateOfferPricesForProducts = async (products, date = new Date()) => {
  try {
    const productsWithOffers = await Promise.all(
      products.map(async (product) => {
        const offerCalculation = await calculateBestOfferPrice(product, date);
        return {
          ...product.toObject ? product.toObject() : product,
          offerPrice: offerCalculation.discountedPrice,
          originalPrice: offerCalculation.originalPrice,
          savings: offerCalculation.savings,
          hasOffer: offerCalculation.hasOffer,
          offerDetails: offerCalculation.offerDetails
        };
      })
    );

    return productsWithOffers;
  } catch (error) {
    console.error('Error calculating offer prices for products:', error);
    return products;
  }
};


export const getEffectivePrice = async (product, date = new Date()) => {
  const offerCalculation = await calculateBestOfferPrice(product, date);
  return offerCalculation.discountedPrice;
};

export const hasActiveOffer = async (product, date = new Date()) => {
  const offerCalculation = await calculateBestOfferPrice(product, date);
  return offerCalculation.hasOffer;
};