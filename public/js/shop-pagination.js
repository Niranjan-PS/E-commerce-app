/**
 * Shop Page Pagination Implementation
 * Handles smooth pagination for the shop page with filters
 */

class ShopPagination extends PaginationUtils {
  constructor() {
    super({
      contentContainerSelector: '.products-grid-container',
      paginationContainerSelector: '.pagination-container',
      loadingText: 'Loading products...',
      scrollOffset: 150
    });

    this.initializeFilters();
  }

  initializeFilters() {
    // Don't bind filter events here - they're handled by the main shop.ejs script
    // This prevents conflicts with existing validation logic
    console.log('Shop pagination initialized');
  }

  updateContent(data) {
    const productsContainer = document.querySelector('#productGrid');
    if (!productsContainer) return;

    if (data.products && data.products.length > 0) {
      let productsHTML = '';

      data.products.forEach(product => {
        const salePrice = product.salePrice || product.price;
        const regularPrice = product.price;
        const hasDiscount = salePrice < regularPrice;
        const discountPercent = hasDiscount ? Math.round(((regularPrice - salePrice) / regularPrice) * 100) : 0;

        // Generate star rating
        const rating = product.averageRating || 0;
        const fullStars = Math.floor(rating);
        const hasHalfStar = (rating % 1) >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

        let starsHTML = '';
        for (let i = 0; i < fullStars; i++) {
          starsHTML += '<span class="star filled">★</span>';
        }
        if (hasHalfStar) {
          starsHTML += '<span class="star half">★</span>';
        }
        for (let i = 0; i < emptyStars; i++) {
          starsHTML += '<span class="star empty">☆</span>';
        }

        productsHTML += `
          <div class="col-md-4">
            <div class="card product-card" style="position: relative;">
              <!-- Wishlist Button -->
              <button class="btn btn-outline-danger wishlist-btn" onclick="addToWishlist('${product._id}')" style="position: absolute; top: 10px; right: 10px; z-index: 10; border-radius: 50%; width: 40px; height: 40px; padding: 0; background: rgba(255,255,255,0.9); border: 1px solid #dc3545;">
                <i class="fas fa-heart" style="color: #dc3545;"></i>
              </button>

              <a href="/product/${product._id}" class="text-decoration-none">
                <div class="product-thumb">
                  ${product.productImage && product.productImage.length > 0 ?
                    `<img src="/uploads/product-images/${product.productImage[0]}" alt="${product.productName}" />` :
                    `<img src="/images/default-product.jpg" alt="No image" />`
                  }
                </div>
                <div class="product-info">
                  <h5 class="product-title text-dark">${product.productName}</h5>
                  <p class="product-category text-muted">${product.category ? product.category.categoryName : "Uncategorized"}</p>

                  <!-- Rating Display -->
                  <div class="product-rating mb-2">
                    <div class="stars">
                      ${starsHTML}
                    </div>
                    <span class="rating-text">
                      ${product.ratingCount > 0 ?
                        `(${rating.toFixed(1)}) ${product.ratingCount} rating${product.ratingCount !== 1 ? 's' : ''}` :
                        'No ratings yet'
                      }
                    </span>
                  </div>

                  <div class="price-section">
                    ${hasDiscount ? `
                      <div class="d-flex align-items-center flex-wrap">
                        <span class="sale-price text-success fw-bold fs-5">₹${salePrice.toFixed(2)}</span>
                        <span class="original-price text-muted text-decoration-line-through ms-2">₹${regularPrice.toFixed(2)}</span>
                      </div>
                      ${discountPercent > 0 ? `
                        <div class="mt-1">
                          <span class="discount-badge bg-danger text-white px-2 py-1 rounded" style="font-size: 0.75rem; font-weight: bold;">-${discountPercent}% OFF</span>
                        </div>
                      ` : ''}
                      <div class="savings-text mt-1">
                        <small class="text-success fw-bold">Save ₹${(regularPrice - salePrice).toFixed(2)}</small>
                      </div>
                    ` : `
                      <span class="product-price text-primary fw-bold fs-5">₹${regularPrice.toFixed(2)}</span>
                    `}
                  </div>
                </div>
              </a>
            </div>
          </div>
        `;
      });

      productsContainer.innerHTML = productsHTML;

      // Update results info
      this.updateResultsInfo(data);

    } else {
      productsContainer.innerHTML = `
        <div class="col-12">
          <div class="text-center py-5">
            <i class="fas fa-search fa-3x text-muted mb-3"></i>
            <h4 class="text-muted">No products found</h4>
            <p class="text-muted">Try adjusting your search criteria or filters.</p>
          </div>
        </div>
      `;
    }
  }

  updateResultsInfo(data) {
    const resultsInfo = document.querySelector('.results-info');
    if (resultsInfo && data.totalProducts !== undefined) {
      const start = ((data.currentPage - 1) * (data.itemsPerPage || 8)) + 1;
      const end = Math.min(start + (data.products?.length || 0) - 1, data.totalProducts);

      resultsInfo.innerHTML = `
        Showing ${start}-${end} of ${data.totalProducts} products
        ${data.searchQuery ? `for "${data.searchQuery}"` : ''}
      `;
    }
  }

  showLoading() {
    super.showLoading();

    // Add skeleton loading to products grid
    const productsContainer = document.querySelector('#productGrid');
    if (productsContainer) {
      let skeletonHTML = '';
      for (let i = 0; i < 6; i++) {
        skeletonHTML += `
          <div class="col-md-4">
            <div class="card product-card">
              <div class="placeholder-glow">
                <div class="placeholder" style="height: 200px; background-color: #e9ecef;"></div>
              </div>
              <div class="card-body">
                <div class="placeholder-glow">
                  <span class="placeholder col-8"></span>
                  <span class="placeholder col-6"></span>
                  <span class="placeholder col-4"></span>
                </div>
              </div>
            </div>
          </div>
        `;
      }
      productsContainer.innerHTML = skeletonHTML;
    }
  }
}

// Initialize shop pagination when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname === '/shop' || window.location.pathname.startsWith('/shop')) {
    window.shopPagination = new ShopPagination();
  }
});
