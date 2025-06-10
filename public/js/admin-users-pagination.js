/**
 * Admin Users Page Pagination Implementation
 * Handles smooth pagination for the admin users management page
 */

class AdminUsersPagination extends PaginationUtils {
  constructor() {
    super({
      contentContainerSelector: '.users-table-container',
      paginationContainerSelector: '.pagination-container',
      loadingText: 'Loading users...',
      scrollOffset: 100
    });

    this.initializeFilters();
  }

  initializeFilters() {
    this.bindSearchFilter();
    this.bindStatusFilter();
  }

  bindSearchFilter() {
    const searchInput = document.querySelector('#searchInput');

    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          const search = e.target.value.trim();
          this.updateFilters({ search });
        }, 500); // 500ms delay for search
      });
    }
  }

  bindStatusFilter() {
    const statusSelect = document.querySelector('#statusFilter');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        const status = e.target.value;
        this.updateFilters({ status });
      });
    }
  }

  updateContent(data) {
    const tableBody = document.querySelector('#usersTableBody');
    if (!tableBody) return;

    if (data.users && data.users.length > 0) {
      let usersHTML = '';

      data.users.forEach((user, index) => {
        const serialNumber = ((data.currentPage - 1) * 5) + index + 1;
        const statusBadge = user.isBlocked ?
          '<span class="badge bg-danger">Blocked</span>' :
          '<span class="badge bg-success">Active</span>';

        const actionButton = user.isBlocked ?
          `<button class="btn btn-success btn-sm" onclick="toggleUserStatus('${user._id}', ${user.isBlocked})">
             <i class="fas fa-unlock"></i> Unblock
           </button>` :
          `<button class="btn btn-danger btn-sm" onclick="toggleUserStatus('${user._id}', ${user.isBlocked})">
             <i class="fas fa-lock"></i> Block
           </button>`;

        usersHTML += `
          <tr>
            <td>${serialNumber}</td>
            <td>${user.name || 'N/A'}</td>
            <td>${user.email || 'N/A'}</td>
            <td>${user.phone || 'N/A'}</td>
            <td>${statusBadge}</td>
            <td>${new Date(user.createdAt).toLocaleDateString()}</td>
            <td>${actionButton}</td>
          </tr>
        `;
      });

      tableBody.innerHTML = usersHTML;

      // Update results info
      this.updateResultsInfo(data);

    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4">
            <i class="fas fa-users fa-3x text-muted mb-3"></i>
            <h5 class="text-muted">No users found</h5>
            <p class="text-muted">Try adjusting your search criteria.</p>
          </td>
        </tr>
      `;
    }
  }

  updateResultsInfo(data) {
    const resultsInfo = document.querySelector('.results-info');
    if (resultsInfo && data.totalUsers !== undefined) {
      const start = ((data.currentPage - 1) * 5) + 1;
      const end = Math.min(start + (data.users?.length || 0) - 1, data.totalUsers);

      resultsInfo.innerHTML = `
        Showing ${start}-${end} of ${data.totalUsers} users
        ${data.search ? `for "${data.search}"` : ''}
      `;
    }
  }

  showLoading() {
    super.showLoading();

    // Add skeleton loading to table
    const tableBody = document.querySelector('#usersTableBody');
    if (tableBody) {
      let skeletonHTML = '';
      for (let i = 0; i < 5; i++) {
        skeletonHTML += `
          <tr>
            <td><div class="placeholder-glow"><span class="placeholder col-6"></span></div></td>
            <td><div class="placeholder-glow"><span class="placeholder col-8"></span></div></td>
            <td><div class="placeholder-glow"><span class="placeholder col-10"></span></div></td>
            <td><div class="placeholder-glow"><span class="placeholder col-7"></span></div></td>
            <td><div class="placeholder-glow"><span class="placeholder col-5"></span></div></td>
            <td><div class="placeholder-glow"><span class="placeholder col-6"></span></div></td>
            <td><div class="placeholder-glow"><span class="placeholder col-4"></span></div></td>
          </tr>
        `;
      }
      tableBody.innerHTML = skeletonHTML;
    }
  }
}

// Initialize admin users pagination when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname === '/admin/users' || window.location.pathname.startsWith('/admin/users')) {
    window.adminUsersPagination = new AdminUsersPagination();
  }
});
