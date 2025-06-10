/**
 * Reusable Pagination Utility for Smooth AJAX Pagination
 * Provides loading spinners and smooth transitions without page reloads
 */

class PaginationUtils {
  constructor(options = {}) {
    this.options = {
      loadingSpinnerClass: 'pagination-loading-spinner',
      contentContainerSelector: options.contentContainerSelector || '.content-container',
      paginationContainerSelector: options.paginationContainerSelector || '.pagination-container',
      loadingText: options.loadingText || 'Loading...',
      errorText: options.errorText || 'Failed to load data. Please try again.',
      fadeTransition: options.fadeTransition !== false,
      scrollToTop: options.scrollToTop !== false,
      scrollOffset: options.scrollOffset || 100,
      ...options
    };
    
    this.isLoading = false;
    this.currentFilters = {};
    this.init();
  }

  init() {
    this.createLoadingSpinner();
    this.bindPaginationEvents();
  }

  createLoadingSpinner() {
    if (document.getElementById(this.options.loadingSpinnerClass)) return;
    
    const spinnerHTML = `
      <div id="${this.options.loadingSpinnerClass}" class="text-center py-5" style="display: none;">
        <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div class="h5 text-muted">${this.options.loadingText}</div>
      </div>
    `;
    
    // Add spinner to body if not exists
    if (!document.querySelector(`.${this.options.loadingSpinnerClass}`)) {
      document.body.insertAdjacentHTML('beforeend', spinnerHTML);
    }
  }

  showLoading(container) {
    if (this.isLoading) return;
    this.isLoading = true;
    
    const contentContainer = container || document.querySelector(this.options.contentContainerSelector);
    const spinner = document.getElementById(this.options.loadingSpinnerClass);
    
    if (contentContainer && this.options.fadeTransition) {
      contentContainer.style.opacity = '0.5';
      contentContainer.style.pointerEvents = 'none';
    }
    
    if (spinner) {
      spinner.style.display = 'block';
      if (contentContainer) {
        contentContainer.appendChild(spinner);
      }
    }
  }

  hideLoading(container) {
    this.isLoading = false;
    
    const contentContainer = container || document.querySelector(this.options.contentContainerSelector);
    const spinner = document.getElementById(this.options.loadingSpinnerClass);
    
    if (contentContainer && this.options.fadeTransition) {
      contentContainer.style.opacity = '1';
      contentContainer.style.pointerEvents = 'auto';
    }
    
    if (spinner) {
      spinner.style.display = 'none';
    }
  }

  bindPaginationEvents() {
    // Use event delegation for dynamic pagination links
    document.addEventListener('click', (e) => {
      const paginationLink = e.target.closest('[data-pagination-page]');
      if (paginationLink && !paginationLink.closest('.disabled')) {
        e.preventDefault();
        const page = parseInt(paginationLink.dataset.paginationPage);
        const url = paginationLink.dataset.paginationUrl || window.location.pathname;
        
        if (page && !this.isLoading) {
          this.loadPage(page, url);
        }
      }
    });
  }

  async loadPage(page, url = window.location.pathname, additionalParams = {}) {
    if (this.isLoading) return;
    
    try {
      // Combine current URL params with new page and additional params
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.set('page', page);
      
      // Add additional parameters
      Object.keys(additionalParams).forEach(key => {
        if (additionalParams[key] !== null && additionalParams[key] !== undefined && additionalParams[key] !== '') {
          urlParams.set(key, additionalParams[key]);
        }
      });

      const requestUrl = `${url}?${urlParams.toString()}`;
      
      this.showLoading();
      
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success !== false) {
        this.updateContent(data);
        this.updatePagination(data);
        this.updateURL(requestUrl);
        
        if (this.options.scrollToTop) {
          this.scrollToContainer();
        }
        
        // Trigger custom event for additional handling
        this.triggerEvent('paginationLoaded', { data, page });
      } else {
        throw new Error(data.message || 'Failed to load data');
      }
      
    } catch (error) {
      console.error('Pagination error:', error);
      this.showError(error.message);
    } finally {
      this.hideLoading();
    }
  }

  updateContent(data) {
    // This method should be overridden by specific implementations
    console.warn('updateContent method should be overridden');
  }

  updatePagination(data) {
    const paginationContainer = document.querySelector(this.options.paginationContainerSelector);
    if (!paginationContainer || !data.totalPages || data.totalPages <= 1) {
      if (paginationContainer) paginationContainer.innerHTML = '';
      return;
    }

    const currentPage = data.currentPage || 1;
    const totalPages = data.totalPages;
    const maxVisiblePages = 5;
    
    let paginationHTML = '<nav aria-label="Page navigation"><ul class="pagination justify-content-center">';
    
    // Previous button
    const prevDisabled = currentPage <= 1 ? 'disabled' : '';
    paginationHTML += `
      <li class="page-item ${prevDisabled}">
        <a class="page-link" href="#" data-pagination-page="${currentPage - 1}" aria-label="Previous">
          <span aria-hidden="true">&laquo;</span>
        </a>
      </li>
    `;
    
    // Calculate page range
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // First page and ellipsis
    if (startPage > 1) {
      paginationHTML += `
        <li class="page-item">
          <a class="page-link" href="#" data-pagination-page="1">1</a>
        </li>
      `;
      if (startPage > 2) {
        paginationHTML += '<li class="page-item disabled"><span class="page-link">...</span></li>';
      }
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      const activeClass = i === currentPage ? 'active' : '';
      paginationHTML += `
        <li class="page-item ${activeClass}">
          <a class="page-link" href="#" data-pagination-page="${i}">${i}</a>
        </li>
      `;
    }
    
    // Last page and ellipsis
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        paginationHTML += '<li class="page-item disabled"><span class="page-link">...</span></li>';
      }
      paginationHTML += `
        <li class="page-item">
          <a class="page-link" href="#" data-pagination-page="${totalPages}">${totalPages}</a>
        </li>
      `;
    }
    
    // Next button
    const nextDisabled = currentPage >= totalPages ? 'disabled' : '';
    paginationHTML += `
      <li class="page-item ${nextDisabled}">
        <a class="page-link" href="#" data-pagination-page="${currentPage + 1}" aria-label="Next">
          <span aria-hidden="true">&raquo;</span>
        </a>
      </li>
    `;
    
    paginationHTML += '</ul></nav>';
    paginationContainer.innerHTML = paginationHTML;
  }

  updateURL(url) {
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, '', url);
    }
  }

  scrollToContainer() {
    const container = document.querySelector(this.options.contentContainerSelector);
    if (container) {
      const offsetTop = container.offsetTop - this.options.scrollOffset;
      window.scrollTo({
        top: Math.max(0, offsetTop),
        behavior: 'smooth'
      });
    }
  }

  showError(message) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: message || this.options.errorText,
        confirmButtonColor: '#dc3545'
      });
    } else {
      alert(message || this.options.errorText);
    }
  }

  triggerEvent(eventName, detail) {
    const event = new CustomEvent(eventName, { detail });
    document.dispatchEvent(event);
  }

  // Utility method to get current filters from URL
  getCurrentFilters() {
    const params = new URLSearchParams(window.location.search);
    const filters = {};
    for (const [key, value] of params) {
      if (key !== 'page') {
        filters[key] = value;
      }
    }
    return filters;
  }

  // Method to update filters and reload
  updateFilters(newFilters, resetPage = true) {
    const page = resetPage ? 1 : this.getCurrentPage();
    this.loadPage(page, window.location.pathname, newFilters);
  }

  getCurrentPage() {
    const params = new URLSearchParams(window.location.search);
    return parseInt(params.get('page')) || 1;
  }
}

// Export for use in other files
window.PaginationUtils = PaginationUtils;
