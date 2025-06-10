/**
 * Global User Status Checker for Real-time Blocking Detection
 * Automatically logs out users (including Google auth users) when blocked by admin
 */

class UserStatusChecker {
  constructor(options = {}) {
    this.options = {
      checkInterval: options.checkInterval || 5000, // 5 seconds for faster detection
      endpoint: options.endpoint || '/api/v1/user/check-status',
      redirectUrl: options.redirectUrl || '/login?error=Account has been blocked',
      showAlert: options.showAlert !== false,
      ...options
    };

    this.isChecking = false;
    this.intervalId = null;
    this.init();
  }

  init() {
    this.startChecking();
    this.bindPageEvents();
  }

  startChecking() {
    console.log('UserStatusChecker: Starting periodic checks every', this.options.checkInterval / 1000, 'seconds');

    // Initial check
    this.checkUserStatus();

    // Set up periodic checking
    this.intervalId = setInterval(() => {
      this.checkUserStatus();
    }, this.options.checkInterval);

    console.log('UserStatusChecker: Periodic checking started');
  }

  stopChecking() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async checkUserStatus() {
    if (this.isChecking) {
      console.log('UserStatusChecker: Already checking, skipping...');
      return;
    }

    try {
      this.isChecking = true;
      console.log('🔍 UserStatusChecker: Checking user status...', new Date().toLocaleTimeString());
      console.log('🔗 UserStatusChecker: Endpoint:', this.options.endpoint);

      const response = await fetch(this.options.endpoint, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      console.log('📡 UserStatusChecker: Response status:', response.status);

      if (!response.ok) {
        console.warn('❌ UserStatusChecker: Status check failed:', response.status);
        return;
      }

      const data = await response.json();
      console.log('📋 UserStatusChecker: Response data:', data);

      // Check specifically for blocked status
      if (data.blocked === true) {
        console.log('🚨 UserStatusChecker: USER IS BLOCKED! Initiating logout...');
        this.handleUserBlocked(data);
      } else if (data.success === false && data.blocked === true) {
        console.log('🚨 UserStatusChecker: USER IS BLOCKED (alt format)! Initiating logout...');
        this.handleUserBlocked(data);
      } else {
        console.log('✅ UserStatusChecker: User status OK, not blocked');
      }

    } catch (error) {
      console.error('💥 UserStatusChecker: Error checking user status:', error);
      // Don't logout on network errors - could be temporary connectivity issues
    } finally {
      this.isChecking = false;
    }
  }

  handleUserBlocked(data) {
    console.log('UserStatusChecker: User is blocked! Handling logout...', data);

    // Stop further checking
    this.stopChecking();

    const message = data.message || 'Your account has been blocked. Please contact support.';
    console.log('UserStatusChecker: Showing block message:', message);

    if (this.options.showAlert) {
      // Use SweetAlert if available, otherwise fallback to alert
      if (typeof Swal !== 'undefined') {
        console.log('UserStatusChecker: Showing SweetAlert');
        Swal.fire({
          icon: 'error',
          title: 'Account Blocked',
          text: message,
          confirmButtonColor: '#d33',
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: true,
          confirmButtonText: 'OK'
        }).then(() => {
          console.log('UserStatusChecker: User confirmed alert, performing logout');
          this.performLogout();
        });
      } else {
        console.log('UserStatusChecker: SweetAlert not available, using alert');
        alert(message);
        this.performLogout();
      }
    } else {
      console.log('UserStatusChecker: No alert configured, performing direct logout');
      this.performLogout();
    }
  }

  performLogout() {
    console.log('UserStatusChecker: Performing complete logout...');

    // Clear authentication cookies
    console.log('UserStatusChecker: Clearing cookies...');
    this.clearAuthCookies();

    // Clear any local storage/session data
    console.log('UserStatusChecker: Clearing local storage...');
    this.clearLocalData();

    // Redirect to login page
    console.log('UserStatusChecker: Redirecting to:', this.options.redirectUrl);
    window.location.href = this.options.redirectUrl;
  }

  clearAuthCookies() {
    // Clear the main authentication token
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname;
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

    // Clear session cookies
    document.cookie = 'connect.sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

    // Clear any other potential auth cookies
    const cookies = document.cookie.split(';');
    cookies.forEach(cookie => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      if (name.includes('auth') || name.includes('session') || name.includes('login')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });
  }

  clearLocalData() {
    try {
      // Clear localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }

      // Clear sessionStorage
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
    } catch (error) {
      console.warn('Could not clear local storage:', error);
    }
  }

  bindPageEvents() {
    // Handle page visibility changes (when user switches tabs/windows)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !this.isChecking) {
        // Check immediately when page becomes visible
        this.checkUserStatus();
      }
    });

    // Handle page show events (back/forward navigation)
    window.addEventListener('pageshow', (event) => {
      if (event.persisted && !this.isChecking) {
        // Check immediately for cached pages
        this.checkUserStatus();
      }
    });

    // Handle focus events
    window.addEventListener('focus', () => {
      if (!this.isChecking) {
        this.checkUserStatus();
      }
    });
  }

  // Method to manually trigger a status check
  checkNow() {
    return this.checkUserStatus();
  }

  // Method to update check interval
  setCheckInterval(interval) {
    this.options.checkInterval = interval;
    this.stopChecking();
    this.startChecking();
  }

  // Method to destroy the checker
  destroy() {
    this.stopChecking();
    // Remove event listeners if needed
  }
}

// Auto-initialize for user pages (not admin pages)
document.addEventListener('DOMContentLoaded', function() {
  // Only initialize on user pages, not admin pages
  const currentPath = window.location.pathname;
  console.log('UserStatusChecker: Current path:', currentPath);

  // Check if we should initialize the status checker
  const shouldInitialize = !currentPath.startsWith('/admin/') &&
                          !currentPath.includes('/login') &&
                          !currentPath.includes('/register') &&
                          !currentPath.includes('/forgot-password') &&
                          !currentPath.includes('/reset-password');

  console.log('UserStatusChecker: Should initialize?', shouldInitialize);

  if (shouldInitialize) {
    console.log('UserStatusChecker: Initializing...');

    try {
      window.userStatusChecker = new UserStatusChecker({
        checkInterval: 5000, // 5 seconds for faster blocking detection
        showAlert: true
      });
      console.log('UserStatusChecker: Initialized successfully');

      // Test the endpoint immediately
      setTimeout(() => {
        console.log('UserStatusChecker: Running initial test...');
        window.userStatusChecker.checkNow();
      }, 1000);

    } catch (error) {
      console.error('UserStatusChecker: Failed to initialize:', error);
    }
  } else {
    console.log('UserStatusChecker: Skipping initialization for this page');
  }
});

// Export for manual use
window.UserStatusChecker = UserStatusChecker;
