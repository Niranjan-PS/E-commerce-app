/**
 * No Back Button Prevention Script
 * Prevents users from going back to cached pages after logout or sensitive operations
 */

(function() {
    'use strict';

    // Prevent back button functionality (only for sensitive pages)
    function preventBackButton() {
        // Only apply back button prevention on specific sensitive pages
        const sensitivePages = ['/admin/', '/login', '/logout', '/profile/edit'];
        const currentPath = window.location.pathname;
        const isSensitivePage = sensitivePages.some(page => currentPath.includes(page));

        // Don't prevent back button on regular user pages like home, shop, etc.
        if (!isSensitivePage) {
            return;
        }

        // Method 1: History manipulation (only for sensitive pages)
        if (window.history && window.history.pushState) {
            // Add a dummy state to history
            window.history.pushState(null, null, window.location.href);

            // Listen for popstate events (back button)
            window.addEventListener('popstate', function(event) {
                // Only prevent back navigation on sensitive pages
                if (isSensitivePage) {
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
                }
            });
        }

        // Method 2: Disable browser cache for this page (only for sensitive pages)
        if (isSensitivePage && window.performance && window.performance.navigation.type === 2) {
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

    // Method 5: Page visibility API to detect when user returns to page (only for sensitive pages)
    function handleVisibilityChange() {
        const sensitivePages = ['/admin/', '/login', '/logout', '/profile/edit'];
        const currentPath = window.location.pathname;
        const isSensitivePage = sensitivePages.some(page => currentPath.includes(page));

        if (document.visibilityState === 'visible' && isSensitivePage) {
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

// Additional method: Force reload on back button for specific pages only
window.addEventListener('pageshow', function(event) {
    const sensitivePages = ['/admin/', '/login', '/logout', '/profile/edit'];
    const currentPath = window.location.pathname;
    const isSensitivePage = sensitivePages.some(page => currentPath.includes(page));

    // If page is loaded from cache (back button) and it's a sensitive page, reload it
    if (event.persisted && isSensitivePage) {
        window.location.reload();
    }
});

// Prevent page from being cached
window.addEventListener('beforeunload', function() {
    // This helps prevent the page from being cached
    return null;
});
