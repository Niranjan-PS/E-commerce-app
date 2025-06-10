# Product Rating System - Frontend Implementation Guide

## Overview
This guide provides simple UI implementations for the product rating system with star ratings, filtering, and user interactions.

## 1. Star Rating Component

### HTML Structure
```html
<!-- Star Rating Display (Read-only) -->
<div class="star-rating-display">
  <div class="stars">
    <span class="star filled">★</span>
    <span class="star filled">★</span>
    <span class="star filled">★</span>
    <span class="star filled">★</span>
    <span class="star">☆</span>
  </div>
  <span class="rating-text">(4.2 out of 5 - 156 ratings)</span>
</div>

<!-- Interactive Star Rating (For rating products) -->
<div class="star-rating-input" data-product-id="PRODUCT_ID">
  <div class="stars">
    <span class="star" data-rating="1">★</span>
    <span class="star" data-rating="2">★</span>
    <span class="star" data-rating="3">★</span>
    <span class="star" data-rating="4">★</span>
    <span class="star" data-rating="5">★</span>
  </div>
  <button class="submit-rating-btn" disabled>Submit Rating</button>
</div>
```

### CSS Styles
```css
.star-rating-display, .star-rating-input {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stars {
  display: flex;
  gap: 2px;
}

.star {
  font-size: 1.2rem;
  color: #ddd;
  cursor: pointer;
  transition: color 0.2s;
}

.star.filled,
.star.active {
  color: #ffc107;
}

.star:hover {
  color: #ffc107;
}

.rating-text {
  font-size: 0.9rem;
  color: #666;
}

.submit-rating-btn {
  padding: 5px 15px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.submit-rating-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
```

### JavaScript Implementation
```javascript
// Initialize star rating functionality
function initializeStarRating() {
  // Handle interactive star ratings
  document.querySelectorAll('.star-rating-input').forEach(ratingContainer => {
    const stars = ratingContainer.querySelectorAll('.star');
    const submitBtn = ratingContainer.querySelector('.submit-rating-btn');
    const productId = ratingContainer.dataset.productId;
    let selectedRating = 0;

    stars.forEach(star => {
      star.addEventListener('click', function() {
        selectedRating = parseInt(this.dataset.rating);
        updateStarDisplay(stars, selectedRating);
        submitBtn.disabled = false;
      });

      star.addEventListener('mouseenter', function() {
        const hoverRating = parseInt(this.dataset.rating);
        updateStarDisplay(stars, hoverRating);
      });
    });

    ratingContainer.addEventListener('mouseleave', function() {
      updateStarDisplay(stars, selectedRating);
    });

    submitBtn.addEventListener('click', function() {
      submitRating(productId, selectedRating);
    });
  });
}

function updateStarDisplay(stars, rating) {
  stars.forEach((star, index) => {
    if (index < rating) {
      star.classList.add('active');
    } else {
      star.classList.remove('active');
    }
  });
}

async function submitRating(productId, rating) {
  try {
    const response = await fetch(`/products/${productId}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rating })
    });

    const data = await response.json();

    if (data.success) {
      // Show success message
      alert('Rating submitted successfully!');
      // Optionally reload the page or update the display
      location.reload();
    } else {
      alert('Error: ' + data.message);
    }
  } catch (error) {
    console.error('Error submitting rating:', error);
    alert('Failed to submit rating. Please try again.');
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeStarRating);
```

## 2. Rating Filter Dropdown

### HTML Structure
```html
<div class="rating-filter">
  <label for="minRating">Minimum Rating:</label>
  <select id="minRating" name="minRating">
    <option value="">All Ratings</option>
    <option value="4">4+ Stars</option>
    <option value="3">3+ Stars</option>
    <option value="2">2+ Stars</option>
    <option value="1">1+ Stars</option>
  </select>
</div>

<div class="sort-options">
  <label for="sortBy">Sort By:</label>
  <select id="sortBy" name="sortBy">
    <option value="">Newest</option>
    <option value="rating">Highest Rated</option>
    <option value="price_low">Price: Low to High</option>
    <option value="price_high">Price: High to Low</option>
  </select>
</div>
```

### JavaScript for Filtering
```javascript
function initializeFilters() {
  const minRatingSelect = document.getElementById('minRating');
  const sortBySelect = document.getElementById('sortBy');

  [minRatingSelect, sortBySelect].forEach(select => {
    select.addEventListener('change', applyFilters);
  });
}

function applyFilters() {
  const minRating = document.getElementById('minRating').value;
  const sortBy = document.getElementById('sortBy').value;
  const searchQuery = document.getElementById('search')?.value || '';
  const category = document.getElementById('category')?.value || '';

  // Build query parameters
  const params = new URLSearchParams();
  if (searchQuery) params.append('search', searchQuery);
  if (category) params.append('category', category);
  if (minRating) params.append('minRating', minRating);
  if (sortBy) params.append('sortBy', sortBy);

  // Redirect with filters
  window.location.href = `/user-products?${params.toString()}`;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeFilters);
```

## 3. Product Card with Rating Display

### HTML Structure
```html
<div class="product-card">
  <img src="product-image.jpg" alt="Product Name">
  <div class="product-info">
    <h3>Product Name</h3>
    <div class="product-rating">
      <div class="stars">
        <!-- Generate stars based on averageRating -->
        <span class="star filled">★</span>
        <span class="star filled">★</span>
        <span class="star filled">★</span>
        <span class="star filled">★</span>
        <span class="star">☆</span>
      </div>
      <span class="rating-info">(4.2) 156 ratings</span>
    </div>
    <div class="price">$99.99</div>
  </div>
</div>
```

### JavaScript for Dynamic Star Generation
```javascript
function generateStarRating(averageRating, ratingCount) {
  const fullStars = Math.floor(averageRating);
  const hasHalfStar = averageRating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  let starsHTML = '';
  
  // Full stars
  for (let i = 0; i < fullStars; i++) {
    starsHTML += '<span class="star filled">★</span>';
  }
  
  // Half star
  if (hasHalfStar) {
    starsHTML += '<span class="star half">★</span>';
  }
  
  // Empty stars
  for (let i = 0; i < emptyStars; i++) {
    starsHTML += '<span class="star">☆</span>';
  }

  return `
    <div class="stars">${starsHTML}</div>
    <span class="rating-info">(${averageRating.toFixed(1)}) ${ratingCount} ratings</span>
  `;
}

// Usage in product rendering
function renderProduct(product) {
  const ratingHTML = generateStarRating(product.averageRating, product.ratingCount);
  
  return `
    <div class="product-card">
      <img src="${product.productImage[0]}" alt="${product.productName}">
      <div class="product-info">
        <h3>${product.productName}</h3>
        <div class="product-rating">${ratingHTML}</div>
        <div class="price">$${product.salePrice || product.price}</div>
      </div>
    </div>
  `;
}
```

## 4. Review Filter by Rating

### HTML Structure
```html
<div class="review-filters">
  <h4>Filter Reviews by Rating:</h4>
  <div class="rating-filter-buttons">
    <button class="rating-filter-btn active" data-rating="">All</button>
    <button class="rating-filter-btn" data-rating="5">5 ★</button>
    <button class="rating-filter-btn" data-rating="4">4 ★</button>
    <button class="rating-filter-btn" data-rating="3">3 ★</button>
    <button class="rating-filter-btn" data-rating="2">2 ★</button>
    <button class="rating-filter-btn" data-rating="1">1 ★</button>
  </div>
</div>
```

### JavaScript for Review Filtering
```javascript
function initializeReviewFilters(productId) {
  document.querySelectorAll('.rating-filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      // Update active state
      document.querySelectorAll('.rating-filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      // Filter reviews
      const rating = this.dataset.rating;
      loadFilteredReviews(productId, rating);
    });
  });
}

async function loadFilteredReviews(productId, rating) {
  try {
    const url = `/reviews/${productId}${rating ? `?rating=${rating}` : ''}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.success) {
      renderReviews(data.reviews);
    }
  } catch (error) {
    console.error('Error loading filtered reviews:', error);
  }
}
```

## 5. Integration with Existing Code

### In Product Details Page
```javascript
// Add to existing product details page
document.addEventListener('DOMContentLoaded', function() {
  const productId = 'CURRENT_PRODUCT_ID'; // Get from page context
  
  // Initialize rating functionality
  initializeStarRating();
  initializeReviewFilters(productId);
  
  // Load user's existing rating
  loadUserRating(productId);
});

async function loadUserRating(productId) {
  try {
    const response = await fetch(`/products/${productId}/user-rating`);
    const data = await response.json();
    
    if (data.success && data.data.hasRated) {
      // Display user's existing rating
      updateStarDisplay(
        document.querySelectorAll('.star-rating-input .star'),
        data.data.userRating
      );
    }
  } catch (error) {
    console.error('Error loading user rating:', error);
  }
}
```

This guide provides a complete frontend implementation for the rating system that integrates seamlessly with the backend API endpoints.
