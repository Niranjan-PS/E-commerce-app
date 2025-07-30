/**
 * Enhanced Wishlist Functionality
 * Handles wishlist operations with improved UX, animations, and duplicate prevention
 */

class EnhancedWishlist {
  constructor() {
    this.wishlistItems = new Set();
    this.isAuthenticated = false;
    this.init();
  }

  async init() {
    try {
      // Check if user is authenticated and load wishlist items
      await this.loadWishlistItems();
      this.updateAllWishlistButtons();
      this.addStyles();
    } catch (error) {
      console.error('Error initializing enhanced wishlist:', error);
    }
  }

  // Add CSS animations and styles
  addStyles() {
    if (document.getElementById('enhanced-wishlist-styles')) return;

    const styles = `
      <style id="enhanced-wishlist-styles">
        /* Wishlist button animations */
        .wishlist-btn {
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .wishlist-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 15px rgba(220, 53, 69, 0.3);
        }

        .wishlist-btn.in-wishlist {
          background: #dc3545 !important;
          border-color: #dc3545 !important;
          color: white !important;
        }

        .wishlist-btn.in-wishlist i {
          color: white !important;
        }

        .wishlist-btn.disabled {
          opacity: 0.6;
          cursor: not-allowed;
          pointer-events: none;
        }

        /* Heart animation */
        .wishlist-btn i {
          transition: all 0.3s ease;
        }

        .wishlist-btn.adding i {
          animation: heartBounce 0.6s ease;
        }

        .wishlist-btn.removing i {
          animation: heartShake 0.5s ease;
        }

        @keyframes heartBounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0) scale(1);
          }
          40% {
            transform: translateY(-8px) scale(1.2);
          }
          60% {
            transform: translateY(-4px) scale(1.1);
          }
        }

        @keyframes heartShake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }

        @keyframes heartPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }

        .wishlist-btn.pulse i {
          animation: heartPulse 0.4s ease;
        }

        /* Loading state */
        .wishlist-btn.loading {
          opacity: 0.7;
          pointer-events: none;
        }

        .wishlist-btn.loading i {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Tooltip styles */
        .wishlist-tooltip {
          position: absolute;
          bottom: 120%;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
          z-index: 1000;
        }

        .wishlist-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-top-color: rgba(0, 0, 0, 0.8);
        }

        .wishlist-btn:hover .wishlist-tooltip {
          opacity: 1;
        }
      </style>
    `;
    document.head.insertAdjacentHTML('beforeend', styles);
  }

  // Load user's wishlist items
  async loadWishlistItems() {
    try {
      const response = await fetch('/api/wishlist/items', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.wishlistItems = new Set(data.productIds);
          this.isAuthenticated = true;
        }
      } else if (response.status === 401) {
        this.isAuthenticated = false;
      }
    } catch (error) {
      console.error('Error loading wishlist items:', error);
      this.isAuthenticated = false;
    }
  }

  // Update all wishlist buttons on the page
  updateAllWishlistButtons() {
    const buttons = document.querySelectorAll('.wishlist-btn');
    buttons.forEach(button => {
      const productId = this.getProductIdFromButton(button);
      if (productId) {
        this.updateButtonState(button, productId);
        this.addTooltip(button, productId);
      }
    });
  }

  // Get product ID from button
  getProductIdFromButton(button) {
    const onclick = button.getAttribute('onclick');
    if (onclick) {
      const match = onclick.match(/addToWishlist\(['"]([^'"]+)['"]\)/);
      return match ? match[1] : null;
    }
    return button.dataset.productId;
  }

  // Update button state based on wishlist status
  updateButtonState(button, productId) {
    const isInWishlist = this.wishlistItems.has(productId);
    const icon = button.querySelector('i');
    
    if (isInWishlist) {
      button.classList.add('in-wishlist');
      button.classList.remove('disabled');
      if (icon) {
        icon.className = 'fas fa-heart'; // Filled heart
      }
    } else {
      button.classList.remove('in-wishlist');
      button.classList.remove('disabled');
      if (icon) {
        icon.className = 'fas fa-heart'; // Regular heart
      }
    }

    // Update onclick handler
    button.setAttribute('onclick', `enhancedWishlist.toggleWishlist('${productId}', this)`);
  }

  // Add tooltip to button
  addTooltip(button, productId) {
    // Remove existing tooltip
    const existingTooltip = button.querySelector('.wishlist-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }

    const isInWishlist = this.wishlistItems.has(productId);
    const tooltipText = isInWishlist ? 'Remove from wishlist' : 'Add to wishlist';
    
    const tooltip = document.createElement('div');
    tooltip.className = 'wishlist-tooltip';
    tooltip.textContent = tooltipText;
    button.appendChild(tooltip);
  }

  // Toggle wishlist item (main function)
  async toggleWishlist(productId, buttonElement) {
    if (!this.isAuthenticated) {
      this.showGuestMessage();
      return;
    }

    const isInWishlist = this.wishlistItems.has(productId);
    
    if (isInWishlist) {
      await this.removeFromWishlist(productId, buttonElement);
    } else {
      await this.addToWishlist(productId, buttonElement);
    }
  }

  // Add to wishlist
  async addToWishlist(productId, buttonElement) {
    try {
      // Add loading state
      this.setButtonLoading(buttonElement, true);

      const response = await fetch('/wishlist/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ productId })
      });

      const data = await response.json();

      if (data.success) {
        // Add to local set
        this.wishlistItems.add(productId);
        
        // Update button state
        this.updateButtonState(buttonElement, productId);
        
        // Add animation
        buttonElement.classList.add('adding');
        setTimeout(() => buttonElement.classList.remove('adding'), 600);

        // Show success message
        Swal.fire({
          icon: 'success',
          title: 'Added to Wishlist!',
          text: data.message,
          confirmButtonColor: '#6200ea',
          timer: 2000,
          timerProgressBar: true,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });

        // Update wishlist count
        this.updateWishlistCount();

      } else {
        // Handle duplicate or error
        if (data.message.includes('already in')) {
          this.showAlreadyInWishlistMessage();
          // Update local state in case of sync issues
          this.wishlistItems.add(productId);
          this.updateButtonState(buttonElement, productId);
        } else {
          this.showErrorMessage(data.message);
        }
      }

    } catch (error) {
      console.error('Error adding to wishlist:', error);
      this.showErrorMessage('Failed to add item to wishlist');
    } finally {
      this.setButtonLoading(buttonElement, false);
    }
  }

  // Remove from wishlist
  async removeFromWishlist(productId, buttonElement) {
    try {
      // Show confirmation
      const confirmed = await Swal.fire({
        title: 'Remove from Wishlist?',
        text: 'Are you sure you want to remove this item from your wishlist?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, remove it',
        cancelButtonText: 'Cancel'
      });

      if (!confirmed.isConfirmed) {
        return;
      }

      // Add loading state
      this.setButtonLoading(buttonElement, true);

      const response = await fetch(`/wishlist/remove/${productId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        // Remove from local set
        this.wishlistItems.delete(productId);
        
        // Update button state
        this.updateButtonState(buttonElement, productId);
        
        // Add animation
        buttonElement.classList.add('removing');
        setTimeout(() => buttonElement.classList.remove('removing'), 500);

        // Show success message
        Swal.fire({
          icon: 'success',
          title: 'Removed from Wishlist',
          text: data.message,
          confirmButtonColor: '#6200ea',
          timer: 2000,
          timerProgressBar: true,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });

        // Update wishlist count
        this.updateWishlistCount();

      } else {
        this.showErrorMessage(data.message);
      }

    } catch (error) {
      console.error('Error removing from wishlist:', error);
      this.showErrorMessage('Failed to remove item from wishlist');
    } finally {
      this.setButtonLoading(buttonElement, false);
    }
  }

  // Set button loading state
  setButtonLoading(button, isLoading) {
    if (isLoading) {
      button.classList.add('loading');
      button.style.pointerEvents = 'none';
    } else {
      button.classList.remove('loading');
      button.style.pointerEvents = 'auto';
    }
  }

  // Update wishlist count in header
  async updateWishlistCount() {
    try {
      const response = await fetch('/api/wishlist/count', {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success) {
        const countElement = document.getElementById('wishlistCount');
        if (countElement) {
          countElement.textContent = data.wishlistCount;
        }
      }
    } catch (error) {
      console.error('Error updating wishlist count:', error);
    }
  }

  // Show message for already in wishlist
  showAlreadyInWishlistMessage() {
    Swal.fire({
      icon: 'info',
      title: 'Already in Wishlist',
      text: 'This product is already in your wishlist. Go check it out!',
      confirmButtonColor: '#6200ea',
      confirmButtonText: 'View Wishlist',
      showCancelButton: true,
      cancelButtonText: 'OK'
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.href = '/wishlist';
      }
    });
  }

  // Show error message
  showErrorMessage(message) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: message,
      confirmButtonColor: '#6200ea'
    });
  }

  // Show guest message
  showGuestMessage() {
    Swal.fire({
      icon: 'info',
      title: 'Login Required',
      text: 'Please login to add items to your wishlist.',
      confirmButtonColor: '#6200ea',
      confirmButtonText: 'Login',
      showCancelButton: true,
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.href = '/login';
      }
    });
  }

  // Refresh wishlist state (useful for dynamic content)
  async refresh() {
    await this.loadWishlistItems();
    this.updateAllWishlistButtons();
  }

  // Check if product is in wishlist
  isInWishlist(productId) {
    return this.wishlistItems.has(productId);
  }

  // Get wishlist count
  getWishlistCount() {
    return this.wishlistItems.size;
  }
}

// Initialize enhanced wishlist when DOM is loaded
let enhancedWishlist;

document.addEventListener('DOMContentLoaded', function() {
  enhancedWishlist = new EnhancedWishlist();
});

// Make it globally available
window.enhancedWishlist = enhancedWishlist;

// Legacy support for existing addToWishlist calls
window.addToWishlist = function(productId) {
  if (window.enhancedWishlist) {
    const button = event.target.closest('.wishlist-btn');
    window.enhancedWishlist.toggleWishlist(productId, button);
  } else {
    // Fallback to original function if enhanced wishlist not loaded
    console.warn("Enhanced wishlist not loaded, using fallback");
    // Original addToWishlist logic here if needed
  }
};