import mongoose from 'mongoose';
import { Product } from '../model/productModel.js';
import { ProductOffer } from '../model/productOfferModel.js';
import { CategoryOffer } from '../model/categoryOfferModel.js';
import { Category } from '../model/categoryModel.js';
import { calculateBestOfferPrice } from '../utils/offerCalculator.js';

/**
 * Test script to verify the offer system is working correctly
 */
async function testOfferSystem() {
  try {
    console.log('🧪 Testing Offer System...\n');

    // Test 1: Product with no offers
    console.log('Test 1: Product with no offers');
    const products = await Product.find().populate('category').limit(1);
    if (products.length > 0) {
      const product = products[0];
      const result = await calculateBestOfferPrice(product);
      console.log(`Product: ${product.productName}`);
      console.log(`Original Price: ₹${result.originalPrice}`);
      console.log(`Discounted Price: ₹${result.discountedPrice}`);
      console.log(`Has Offer: ${result.hasOffer}`);
      console.log(`Savings: ₹${result.savings}\n`);
    }

    // Test 2: Check for active product offers
    console.log('Test 2: Active Product Offers');
    const activeProductOffers = await ProductOffer.find({
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    }).populate('product');
    
    console.log(`Found ${activeProductOffers.length} active product offers`);
    for (const offer of activeProductOffers.slice(0, 3)) {
      if (offer.product) {
        console.log(`- ${offer.offerName}: ${offer.discountPercentage}% off on ${offer.product.productName}`);
      }
    }
    console.log();

    // Test 3: Check for active category offers
    console.log('Test 3: Active Category Offers');
    const activeCategoryOffers = await CategoryOffer.find({
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    }).populate('category');
    
    console.log(`Found ${activeCategoryOffers.length} active category offers`);
    for (const offer of activeCategoryOffers.slice(0, 3)) {
      if (offer.category) {
        console.log(`- ${offer.offerName}: ${offer.discountPercentage}% off on ${offer.category.name} category`);
      }
    }
    console.log();

    // Test 4: Test offer calculation for a product with offers
    console.log('Test 4: Product with offers');
    if (activeProductOffers.length > 0) {
      const offerProduct = activeProductOffers[0].product;
      if (offerProduct) {
        await offerProduct.populate('category');
        const result = await calculateBestOfferPrice(offerProduct);
        console.log(`Product: ${offerProduct.productName}`);
        console.log(`Original Price: ₹${result.originalPrice}`);
        console.log(`Discounted Price: ₹${result.discountedPrice}`);
        console.log(`Has Offer: ${result.hasOffer}`);
        console.log(`Savings: ₹${result.savings}`);
        if (result.offerDetails) {
          console.log(`Offer: ${result.offerDetails.name} (${result.offerDetails.type})`);
        }
        console.log();
      }
    }

    // Test 5: Performance test
    console.log('Test 5: Performance Test');
    const startTime = Date.now();
    const testProducts = await Product.find().populate('category').limit(10);
    
    for (const product of testProducts) {
      await calculateBestOfferPrice(product);
    }
    
    const endTime = Date.now();
    console.log(`Calculated offers for ${testProducts.length} products in ${endTime - startTime}ms`);
    console.log(`Average: ${(endTime - startTime) / testProducts.length}ms per product\n`);

    console.log('✅ Offer system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Run test if this file is executed directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  // Connect to database
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
  
  // Run test
  await testOfferSystem();
  
  // Close connection
  await mongoose.connection.close();
  console.log('Database connection closed.');
}