# Admin Dashboard Analytics Features

## Overview
This document describes the new analytics features implemented in the Admin Dashboard. These features provide comprehensive insights into sales performance, product popularity, and business metrics.

## Features Implemented

### 1. Sales Analytics Chart
- **Location**: Main dashboard analytics section
- **Description**: Interactive line chart showing sales performance over time
- **Features**:
  - Filter by time period (Daily, Monthly, Yearly)
  - Dual-axis chart showing both sales amount and order count
  - Real-time data updates
  - Responsive design

### 2. Dashboard Statistics Cards
- **Real-time metrics**:
  - Total Users (active, non-blocked users)
  - Total Orders (all orders)
  - Total Sales (from delivered orders only)
  - Total Pending (orders in pending states)

### 3. Top 10 Best-Selling Products
- **Display**: Both list view (top 5) and bar chart (top 10)
- **Metrics**: Quantity sold, revenue generated
- **Sorting**: By total quantity sold

### 4. Top 10 Best-Selling Categories
- **Display**: Both list view (top 5) and doughnut chart (top 10)
- **Metrics**: Total revenue, quantity sold
- **Sorting**: By total revenue

### 5. Top 10 Best-Selling Brands
- **Display**: Both list view (top 5) and horizontal bar chart (top 10)
- **Metrics**: Total revenue, product count
- **Sorting**: By total revenue
- **Note**: Brands are extracted from product names (first word)

## API Endpoints

### Analytics API Routes
All routes are protected with `isAdminAuthenticated` middleware:

```javascript
GET /admin/api/analytics/sales
GET /admin/api/analytics/top-products
GET /admin/api/analytics/top-categories
GET /admin/api/analytics/top-brands
GET /admin/api/analytics/dashboard-stats
```

### Query Parameters

#### Sales Analytics (`/admin/api/analytics/sales`)
- `period`: `daily` | `monthly` | `yearly` (default: `daily`)
- `startDate`: ISO date string (optional)
- `endDate`: ISO date string (optional)

#### Top Products/Categories/Brands
- `startDate`: ISO date string (optional)
- `endDate`: ISO date string (optional)

## Technical Implementation

### Backend
- **Controller**: `controllers/admin/analyticsController.js`
- **Database**: MongoDB aggregation pipelines
- **Models**: Order, Product, Category, User
- **Authentication**: Admin authentication required

### Frontend
- **Framework**: Chart.js for data visualization
- **Template Engine**: EJS
- **Styling**: Custom CSS with responsive design
- **JavaScript**: Vanilla JS with async/await for API calls

### Charts Used
1. **Line Chart**: Sales analytics with dual y-axis
2. **Bar Chart**: Top products and brands
3. **Doughnut Chart**: Top categories

## Data Sources

### Sales Data
- Source: `Order` collection
- Filter: Only orders with status `['Delivered', 'Shipped', 'Out for Delivery']`
- Aggregation: Group by date periods, sum total amounts

### Product Data
- Source: `Order.items` with product lookup
- Metrics: Quantity sold, revenue (quantity × discounted price)
- Aggregation: Group by product, sum quantities and revenue

### Category Data
- Source: `Order.items.category`
- Metrics: Total revenue, quantity sold
- Aggregation: Group by category name

### Brand Data
- Source: Product names (first word extraction)
- Metrics: Total revenue, unique product count
- Note: This is a workaround; ideally, products should have a dedicated brand field

## Features

### Responsive Design
- Mobile-friendly layout
- Adaptive grid system
- Collapsible charts on smaller screens

### Real-time Updates
- Refresh button to reload all analytics
- Automatic data fetching on page load
- Error handling with user feedback

### Interactive Elements
- Period selector for sales analytics
- Hover effects on charts
- Loading states during data fetch

## File Structure

```
controllers/admin/
├── analyticsController.js          # New analytics controller

views/admin/
├── dashboard.ejs                   # Updated dashboard with analytics

routes/
├── adminRoutes.js                  # Updated with analytics routes
```

## Usage

1. **Access**: Navigate to `/admin/dashboard` after admin login
2. **View Analytics**: Scroll to the "Analytics Dashboard" section
3. **Filter Data**: Use the period selector for sales analytics
4. **Refresh Data**: Click the refresh button to update all charts
5. **Interact**: Hover over charts for detailed information

## Browser Compatibility
- Modern browsers supporting ES6+
- Chart.js compatible browsers
- Responsive design for mobile devices

## Performance Considerations
- MongoDB aggregation pipelines for efficient data processing
- Indexed queries on order dates and status
- Lazy loading of chart data
- Optimized API responses with only necessary data

## Future Enhancements
1. Add date range picker for custom periods
2. Implement caching for frequently accessed data
3. Add export functionality for analytics data
4. Include more detailed product analytics
5. Add brand field to product model for better brand analytics
6. Implement real-time updates with WebSocket
7. Add comparison features (period-over-period)

## Error Handling
- Graceful degradation when data is unavailable
- User-friendly error messages
- Console logging for debugging
- Fallback to empty states when no data exists

## Security
- All analytics endpoints require admin authentication
- Input validation for query parameters
- Protection against injection attacks through MongoDB aggregation
- Secure cookie handling for admin sessions