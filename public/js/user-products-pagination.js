/**
 * User Products Page Pagination Implementation
 * Handles smooth pagination for the user products page
 */

class UserProductsPagination extends PaginationUtils {
  constructor() {
    super({
      contentContainerSelector: '.products-grid-container',
      paginationContainerSelector: '.pagination-container',
      loadingText: 'Loading products...',
      scrollOffset: 100
    });
    
    this.initializeFilters();
  }

  initializeFilters() {
    this.bindSearchFilter();
    this.bindCategoryFilter();
  }

  bindSearchFilter() {
    const searchForm = document.querySelector('#searchForm');
    const searchInput = document.querySelector('#searchInput');
    
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const search = searchInput ? searchInput.value.trim() : '';
        this.updateFilters({ search });
      });
    }
  }

  bindCategoryFilter() {
    const categorySelect = document.querySelector('#categoryFilter');
    if (categorySelect) {
      categorySelect.addEventListener('change', (e) => {
        const category = e.target.value;
        this.updateFilters({ category });
      });
    }
  }

  updateContent(data) {
    const productsContainer = document.querySelector('.products-grid-container .row');
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
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        let starsHTML = '';
        for (let i = 0; i < fullStars; i++) {
          starsHTML += '<i class="fas fa-star text-warning"></i>';
        }
        if (hasHalfStar) {
          starsHTML += '<i class="fas fa-star-half-alt text-warning"></i>';
        }
        for (let i = 0; i < emptyStars; i++) {
          starsHTML += '<i class="far fa-star text-warning"></i>';
        }

        productsHTML += `
          <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
            <div class="card product-card h-100 shadow-sm">
              ${hasDiscount ? `<div class="badge bg-danger position-absolute" style="top: 10px; right: 10px; z-index: 1;">${discountPercent}% OFF</div>` : ''}
              
              <div class="product-image-container position-relative">
                <img src="/uploads/product-images/${product.productImage[0]}" 
                     class="card-img-top product-image" 
                     alt="${product.productName}"
                     style="height: 200px; object-fit: cover;">
                
                <div class="product-overlay">
                  <div class="product-actions">
                    <a href="/product-details/${product._id}" class="btn btn-primary btn-sm">
                      <i class="fas fa-eye"></i> View Details
                    </a>
                  </div>
                </div>
              </div>
              
              <div class="card-body d-flex flex-column">
                <h6 class="card-title text-truncate">${product.productName}</h6>
                <p class="text-muted small mb-2">${product.category?.categoryName || 'Uncategorized'}</p>
                
                <div class="rating mb-2">
                  ${starsHTML}
                  <span class="text-muted small ms-1">(${product.ratingCount || 0})</span>
                </div>
                
                <div class="price-section mt-auto">
                  <div class="d-flex align-items-center">
                    <span class="h6 text-success mb-0">₹${salePrice}</span>
                    ${hasDiscount ? `<span class="text-muted text-decoration-line-through ms-2 small">₹${regularPrice}</span>` : ''}
                  </div>
                </div>
                
                <div class="mt-2">
                  <small class="text-muted">
                    <i class="fas fa-box"></i> Stock: ${product.quantity > 0 ? product.quantity : 'Out of Stock'}
                  </small>
                </div>
              </div>
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
    const productsContainer = document.querySelector('.products-grid-container .row');
    if (productsContainer) {
      let skeletonHTML = '';
      for (let i = 0; i < 8; i++) {
        skeletonHTML += `
          <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
            <div class="card h-100">
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

// Initialize user products pagination when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname === '/user-products' || window.location.pathname.startsWith('/user-products')) {
    window.userProductsPagination = new UserProductsPagination();
  }
});
