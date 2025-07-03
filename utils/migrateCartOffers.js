import mongoose from 'mongoose';
import { Cart } from '../model/cartModel.js';
import { Product } from '../model/productModel.js';
import { calculateBestOfferPrice } from './offerCalculator.js';

/**
 * Migration script to update existing cart items with offer calculations
 * This should be run once after implementing the offer system
 */
export const migrateCartOffers = async () => {
  try {
    console.log('Starting cart offers migration...');
    
    // Get all carts with items
    const carts = await Cart.find({ 'items.0': { $exists: true } }).populate({
      path: 'items.product',
      populate: {
        path: 'category'
      }
    });

    console.log(`Found ${carts.length} carts to migrate`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const cart of carts) {
      try {
        let hasChanges = false;

        for (const item of cart.items) {
          // Skip if item already has offer fields
          if (item.originalPrice !== undefined && item.discountedPrice !== undefined) {
            continue;
          }

          const product = item.product;
          if (!product) {
            console.log(`Skipping item with missing product in cart ${cart._id}`);
            continue;
          }

          // Calculate offer price
          const offerCalculation = await calculateBestOfferPrice(product);

          // Update item with offer fields
          item.originalPrice = offerCalculation.originalPrice;
          item.discountedPrice = offerCalculation.discountedPrice;
          item.offerSavings = offerCalculation.savings;
          item.hasOffer = offerCalculation.hasOffer;
          
          if (offerCalculation.offerDetails) {
            item.offerDetails = {
              id: offerCalculation.offerDetails.id,
              name: offerCalculation.offerDetails.name,
              discountPercentage: offerCalculation.offerDetails.discountPercentage,
              type: offerCalculation.offerDetails.type
            };
          } else {
            item.offerDetails = {};
          }

          hasChanges = true;
        }

        if (hasChanges) {
          // Recalculate totals and save
          cart.calculateTotals();
          await cart.save();
          migratedCount++;
          console.log(`Migrated cart ${cart._id} for user ${cart.user}`);
        }

      } catch (error) {
        console.error(`Error migrating cart ${cart._id}:`, error);
        errorCount++;
      }
    }

    console.log(`Migration completed:`);
    console.log(`- Successfully migrated: ${migratedCount} carts`);
    console.log(`- Errors: ${errorCount} carts`);

    return {
      success: true,
      migratedCount,
      errorCount,
      totalCarts: carts.length
    };

  } catch (error) {
    console.error('Migration failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Run migration if this file is executed directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  // Connect to database
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
  
  // Run migration
  const result = await migrateCartOffers();
  
  if (result.success) {
    console.log('Migration completed successfully');
    process.exit(0);
  } else {
    console.error('Migration failed:', result.error);
    process.exit(1);
  }
}