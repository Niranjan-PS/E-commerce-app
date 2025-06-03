/**
 * No Back Button Prevention Script
 * Prevents users from going back to cached pages after logout or sensitive operations
 */

(function() {
    'use strict';

    // Prevent back button functionality
    function preventBackButton() {
        // Method 1: History manipulation
        if (window.history && window.history.pushState) {
            // Add a dummy state to history
            window.history.pushState(null, null, window.location.href);
            
            // Listen for popstate events (back button)
            window.addEventListener('popstate', function(event) {
                // Push the current state again to prevent going back
                window.history.pushState(null, null, window.location.href);
                
                // Optional: Show a message to user
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Navigation Restricted',
                        text: 'Please use the navigation menu to move between pages.',
                        confirmButtonText: 'OK'
                    });
                } else {
                    alert('Please use the navigation menu to move between pages.');
                }
            });
        }

        // Method 2: Disable browser cache for this page
        if (window.performance && window.performance.navigation.type === 2) {
            // Page was accessed via back button, reload it
            window.location.reload();
        }
    }

    // Method 3: Clear browser cache and storage
    function clearBrowserData() {
        try {
            // Clear localStorage
            if (typeof(Storage) !== "undefined" && localStorage) {
                localStorage.clear();
            }
            
            // Clear sessionStorage
            if (typeof(Storage) !== "undefined" && sessionStorage) {
                sessionStorage.clear();
            }
            
            // Clear any cached data
            if ('caches' in window) {
                caches.keys().then(function(names) {
                    for (let name of names) {
                        caches.delete(name);
                    }
                });
            }
        } catch (e) {
            console.log('Cache clearing not supported:', e);
        }
    }

    // Method 4: Disable right-click and keyboard shortcuts (optional)
    function disableShortcuts() {
        // Disable right-click context menu
        document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        });

        // Disable common keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Disable F5 (refresh)
            if (e.keyCode === 116) {
                e.preventDefault();
                return false;
            }
            
            // Disable Ctrl+R (refresh)
            if (e.ctrlKey && e.keyCode === 82) {
                e.preventDefault();
                return false;
            }
            
            // Disable Ctrl+F5 (hard refresh)
            if (e.ctrlKey && e.keyCode === 116) {
                e.preventDefault();
                return false;
            }
            
            // Disable Alt+Left (back)
            if (e.altKey && e.keyCode === 37) {
                e.preventDefault();
                return false;
            }
            
            // Disable Alt+Right (forward)
            if (e.altKey && e.keyCode === 39) {
                e.preventDefault();
                return false;
            }
            
            // Disable Backspace (back) when not in input fields
            if (e.keyCode === 8 && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                e.preventDefault();
                return false;
            }
        });
    }

    // Method 5: Page visibility API to detect when user returns to page
    function handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // Check if this is a cached page load
            if (window.performance && window.performance.navigation.type === 2) {
                // Redirect to login or home page
                window.location.href = '/login';
            }
        }
    }

    // Initialize all prevention methods
    function init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                preventBackButton();
                clearBrowserData();
                
                // Only enable shortcuts disabling for admin pages
                if (window.location.pathname.includes('/admin/')) {
                    disableShortcuts();
                }
                
                // Handle page visibility changes
                document.addEventListener('visibilitychange', handleVisibilityChange);
            });
        } else {
            preventBackButton();
            clearBrowserData();
            
            if (window.location.pathname.includes('/admin/')) {
                disableShortcuts();
            }
            
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }
    }

    // Auto-initialize
    init();

    // Expose methods globally for manual use
    window.NoBackButton = {
        prevent: preventBackButton,
        clearCache: clearBrowserData,
        disableShortcuts: disableShortcuts,
        init: init
    };

})();

// Additional method: Force reload on back button for specific pages
window.addEventListener('pageshow', function(event) {
    // If page is loaded from cache (back button), reload it
    if (event.persisted) {
        window.location.reload();
    }
});

// Prevent page from being cached
window.addEventListener('beforeunload', function() {
    // This helps prevent the page from being cached
    return null;
});
