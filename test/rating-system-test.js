// Test script for the rating system
// This is a manual test guide - run these commands in your application

console.log('=== RATING SYSTEM TEST GUIDE ===');

// Test 1: Rate a product
const testRateProduct = async (productId, rating) => {
  try {
    const response = await fetch(`/products/${productId}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rating })
    });
    
    const data = await response.json();
    console.log('Rate Product Test:', data);
    return data;
  } catch (error) {
    console.error('Rate Product Error:', error);
  }
};

// Test 2: Get product rating stats
const testGetRatingStats = async (productId) => {
  try {
    const response = await fetch(`/products/${productId}/rating-stats`);
    const data = await response.json();
    console.log('Rating Stats Test:', data);
    return data;
  } catch (error) {
    console.error('Rating Stats Error:', error);
  }
};

// Test 3: Get user's rating for a product
const testGetUserRating = async (productId) => {
  try {
    const response = await fetch(`/products/${productId}/user-rating`);
    const data = await response.json();
    console.log('User Rating Test:', data);
    return data;
  } catch (error) {
    console.error('User Rating Error:', error);
  }
};

// Test 4: Filter products by minimum rating
const testFilterProducts = async (minRating) => {
  try {
    const response = await fetch(`/user-products?minRating=${minRating}`);
    const data = await response.json();
    console.log('Filter Products Test:', data);
    return data;
  } catch (error) {
    console.error('Filter Products Error:', error);
  }
};

// Test 5: Filter reviews by rating
const testFilterReviews = async (productId, rating) => {
  try {
    const response = await fetch(`/reviews/${productId}?rating=${rating}`);
    const data = await response.json();
    console.log('Filter Reviews Test:', data);
    return data;
  } catch (error) {
    console.error('Filter Reviews Error:', error);
  }
};

// Manual test instructions
console.log(`
MANUAL TESTING INSTRUCTIONS:

1. Rate a Product:
   POST /products/:id/rate
   Body: { "rating": 4 }
   Expected: Success response with updated rating stats

2. Get Rating Stats:
   GET /products/:id/rating-stats
   Expected: Product rating statistics including distribution

3. Get User Rating:
   GET /products/:id/user-rating
   Expected: User's rating for the product (if exists)

4. Filter Products by Rating:
   GET /user-products?minRating=4
   Expected: Products with average rating >= 4

5. Filter Reviews by Rating:
   GET /reviews/:productId?rating=5
   Expected: Only 5-star reviews for the product

6. Sort Products by Rating:
   GET /user-products?sortBy=rating
   Expected: Products sorted by highest rating first

SAMPLE CURL COMMANDS:

# Rate a product (replace TOKEN and PRODUCT_ID)
curl -X POST http://localhost:3000/products/PRODUCT_ID/rate \\
  -H "Content-Type: application/json" \\
  -H "Cookie: token=YOUR_JWT_TOKEN" \\
  -d '{"rating": 5}'

# Get rating stats
curl http://localhost:3000/products/PRODUCT_ID/rating-stats

# Filter products by rating
curl http://localhost:3000/user-products?minRating=4

# Filter reviews by rating
curl http://localhost:3000/reviews/PRODUCT_ID?rating=5

EXPECTED DATABASE CHANGES:

1. Product document should have:
   - averageRating: calculated from reviews + direct ratings
   - ratingCount: total number of ratings
   - ratings: array of user ratings

2. Review functionality should remain unchanged

3. Product filtering should work with new rating fields

VALIDATION CHECKLIST:

□ Users can rate products (1-5 stars)
□ Duplicate ratings are prevented (updates existing)
□ Average rating is calculated correctly
□ Products can be filtered by minimum rating
□ Reviews can be filtered by specific rating
□ Product sorting by rating works
□ Rating statistics are accurate
□ User's existing rating is retrievable
□ All endpoints use proper error handling
□ HTTP status codes are correct
`);

// Export test functions for use in browser console
if (typeof window !== 'undefined') {
  window.ratingTests = {
    testRateProduct,
    testGetRatingStats,
    testGetUserRating,
    testFilterProducts,
    testFilterReviews
  };
}
