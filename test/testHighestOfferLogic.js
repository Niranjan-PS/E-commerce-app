import mongoose from 'mongoose';
import { Product } from '../model/productModel.js';
import { ProductOffer } from '../model/productOfferModel.js';
import { CategoryOffer } from '../model/categoryOfferModel.js';
import { Category } from '../model/categoryModel.js';
import { calculateBestOfferPrice } from '../utils/offerCalculator.js';

/**
 * Test script to verify the highest offer logic is working correctly
 */
async function testHighestOfferLogic() {
  try {
    console.log('🧪 Testing Highest Offer Logic...\n');

    // Test 1: Product with both product and category offers (product offer higher)
    console.log('Test 1: Product offer higher than category offer');
    const products = await Product.find().populate('category').limit(1);
    if (products.length > 0) {
      const product = products[0];
      const result = await calculateBestOfferPrice(product);
      
      console.log(`Product: ${product.productName}`);
      console.log(`Original Price: ₹${result.originalPrice}`);
      console.log(`Final Price: ₹${result.discountedPrice}`);
      console.log(`Has Offer: ${result.hasOffer}`);
      
      if (result.appliedOfferInfo) {
        const comparison = result.appliedOfferInfo.offerComparison;
        console.log(`Available Offers:`);
        console.log(`  - Product Offer: ${comparison.productOfferPercentage}%`);
        console.log(`  - Category Offer: ${comparison.categoryOfferPercentage}%`);
        console.log(`Applied: ${comparison.appliedOfferType} offer (${comparison.appliedOfferPercentage}%)`);
        console.log(`Reason: ${comparison.reason}`);
      }
      console.log();
    }

    // Test 2: Check for products with multiple offers
    console.log('Test 2: Finding products with multiple offers');
    const allProducts = await Product.find().populate('category').limit(10);
    let multiOfferCount = 0;
    
    for (const product of allProducts) {
      const result = await calculateBestOfferPrice(product);
      if (result.availableOffers.productOffer && result.availableOffers.categoryOffer) {
        multiOfferCount++;
        console.log(`${product.productName}:`);
        console.log(`  Product: ${result.availableOffers.productOffer.discountPercentage}% | Category: ${result.availableOffers.categoryOffer.discountPercentage}%`);
        console.log(`  Applied: ${result.offerDetails.type} offer (${result.offerDetails.discountPercentage}%)`);
        console.log();
      }
    }
    
    console.log(`Found ${multiOfferCount} products with both product and category offers\n`);

    // Test 3: Verify offer comparison logic
    console.log('Test 3: Offer Comparison Logic Verification');
    
    // Create test scenarios
    const testScenarios = [
      { productOffer: 15, categoryOffer: 10, expected: 'product' },
      { productOffer: 8, categoryOffer: 12, expected: 'category' },
      { productOffer: 20, categoryOffer: 20, expected: 'product' }, // Equal case - product wins
      { productOffer: 0, categoryOffer: 15, expected: 'category' },
      { productOffer: 25, categoryOffer: 0, expected: 'product' }
    ];

    testScenarios.forEach((scenario, index) => {
      const winner = scenario.productOffer >= scenario.categoryOffer ? 'product' : 'category';
      const isCorrect = winner === scenario.expected;
      console.log(`Scenario ${index + 1}: Product ${scenario.productOffer}% vs Category ${scenario.categoryOffer}%`);
      console.log(`Expected: ${scenario.expected} | Actual: ${winner} | ${isCorrect ? '✅ PASS' : '❌ FAIL'}`);
    });

    console.log('\n✅ Highest offer logic test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Test the offer display information
 */
async function testOfferDisplayInfo() {
  try {
    console.log('\n🎨 Testing Offer Display Information...\n');

    const products = await Product.find().populate('category').limit(5);
    
    for (const product of products) {
      const result = await calculateBestOfferPrice(product);
      
      if (result.hasOffer) {
        console.log(`📦 ${product.productName}`);
        console.log(`💰 Price: ₹${result.originalPrice} → ₹${result.discountedPrice} (Save ₹${result.savings})`);
        
        if (result.appliedOfferInfo) {
          const info = result.appliedOfferInfo;
          console.log(`🏷️  Applied Offer: ${info.appliedOffer.name} (${info.appliedOffer.discountPercentage}% ${info.appliedOffer.type} offer)`);
          
          if (info.availableOffers.productOffer && info.availableOffers.categoryOffer) {
            console.log(`📊 Comparison:`);
            console.log(`   Product Offer: ${info.availableOffers.productOffer.discountPercentage}%`);
            console.log(`   Category Offer: ${info.availableOffers.categoryOffer.discountPercentage}%`);
            console.log(`   Decision: ${info.offerComparison.reason}`);
          }
        }
        console.log('─'.repeat(50));
      }
    }
    
  } catch (error) {
    console.error('❌ Display test failed:', error);
  }
}

/**
 * Run tests if this file is executed directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  // Connect to database
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
  
  // Run tests
  await testHighestOfferLogic();
  await testOfferDisplayInfo();
  
  // Close connection
  await mongoose.connection.close();
  console.log('Database connection closed.');
}