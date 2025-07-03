import { catchAsyncError } from '../../middlewares/catchAsync.js';
import { Order } from '../../model/orderModel.js';
import { User } from '../../model/userModel.js';
import PDFDocument from 'pdfkit';

// Date utility functions
const formatDate = (date, format = 'YYYY-MM-DD') => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  switch (format) {
    case 'MMMM DD, YYYY':
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    case 'MMM DD, YYYY':
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    case 'MMMM YYYY':
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    case 'MM/DD/YY':
      return `${month}/${day}/${String(year).slice(-2)}`;
    case 'YYYY-MM-DD HH:mm':
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    default:
      return `${year}-${month}-${day}`;
  }
};

const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

const getStartOfWeek = (year, week) => {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }
  return ISOweekStart;
};

const getEndOfWeek = (startOfWeek) => {
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return endOfWeek;
};

/**
 * Get sales reports page
 */
export const getSalesReports = catchAsyncError(async (req, res, next) => {
  try {
    res.render('admin/sales-reports', {
      title: 'Sales Reports',
      page: 'sales-reports'
    });
  } catch (error) {
    console.error('Error loading sales reports page:', error);
    res.status(500).render('error', {
      message: 'Failed to load sales reports page'
    });
  }
});

/**
 * Get sales data with filters
 */
export const getSalesData = catchAsyncError(async (req, res, next) => {
  try {
    const { filterType, startDate, endDate, selectedDate, selectedWeek, selectedMonth } = req.query;
    
    // Build date filter based on filter type
    let dateFilter = {};
    let reportTitle = '';
    
    switch (filterType) {
      case 'daily':
        if (selectedDate) {
          const date = new Date(selectedDate);
          const startOfDay = new Date(date.setHours(0, 0, 0, 0));
          const endOfDay = new Date(date.setHours(23, 59, 59, 999));
          dateFilter = {
            orderDate: {
              $gte: startOfDay,
              $lte: endOfDay
            }
          };
          reportTitle = `Daily Report - ${formatDate(selectedDate, 'MMMM DD, YYYY')}`;
        } else {
          // Default to today
          const today = new Date();
          const startOfDay = new Date(today.setHours(0, 0, 0, 0));
          const endOfDay = new Date(today.setHours(23, 59, 59, 999));
          dateFilter = {
            orderDate: {
              $gte: startOfDay,
              $lte: endOfDay
            }
          };
          reportTitle = `Daily Report - Today (${formatDate(new Date(), 'MMMM DD, YYYY')})`;
        }
        break;
        
      case 'weekly':
        if (selectedWeek) {
          const [year, week] = selectedWeek.split('-W');
          const startOfWeek = getStartOfWeek(parseInt(year), parseInt(week));
          const endOfWeek = getEndOfWeek(startOfWeek);
          dateFilter = {
            orderDate: {
              $gte: startOfWeek,
              $lte: endOfWeek
            }
          };
          reportTitle = `Weekly Report - Week ${week}, ${year}`;
        } else {
          // Default to current week
          const today = new Date();
          const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
          startOfWeek.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          dateFilter = {
            orderDate: {
              $gte: startOfWeek,
              $lte: endOfWeek
            }
          };
          reportTitle = `Weekly Report - Current Week`;
        }
        break;
        
      case 'monthly':
        if (selectedMonth) {
          const [year, month] = selectedMonth.split('-');
          const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
          const endOfMonth = new Date(parseInt(year), parseInt(month), 0);
          endOfMonth.setHours(23, 59, 59, 999);
          dateFilter = {
            orderDate: {
              $gte: startOfMonth,
              $lte: endOfMonth
            }
          };
          reportTitle = `Monthly Report - ${formatDate(startOfMonth, 'MMMM YYYY')}`;
        } else {
          // Default to current month
          const today = new Date();
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          endOfMonth.setHours(23, 59, 59, 999);
          dateFilter = {
            orderDate: {
              $gte: startOfMonth,
              $lte: endOfMonth
            }
          };
          reportTitle = `Monthly Report - ${formatDate(new Date(), 'MMMM YYYY')}`;
        }
        break;
        
      case 'custom':
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999); // Include the entire end date
          dateFilter = {
            orderDate: {
              $gte: start,
              $lte: end
            }
          };
          reportTitle = `Custom Report - ${formatDate(startDate, 'MMM DD, YYYY')} to ${formatDate(endDate, 'MMM DD, YYYY')}`;
        } else {
          return res.status(400).json({
            success: false,
            message: 'Start date and end date are required for custom filter'
          });
        }
        break;
        
      default:
        // Default to current month if no filter specified
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        dateFilter = {
          orderDate: {
            $gte: startOfMonth,
            $lte: endOfMonth
          }
        };
        reportTitle = `Monthly Report - ${formatDate(new Date(), 'MMMM YYYY')}`;
    }

    // Only include completed/delivered orders
    const orderStatusFilter = {
      orderStatus: { $in: ['Delivered', 'Completed'] }
    };

    const combinedFilter = { ...dateFilter, ...orderStatusFilter };

    // Get orders with populated data
    const orders = await Order.find(combinedFilter)
      .populate('user', 'name email')
      .populate('items.product', 'productName')
      .sort({ orderDate: -1 });

    // Calculate metrics
    const totalSalesCount = orders.length;
    const totalSalesAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    
    // Calculate total discounts from offers
    const totalOfferDiscounts = orders.reduce((sum, order) => {
      return sum + order.items.reduce((itemSum, item) => {
        if (item.hasOffer && item.originalPrice && item.discountedPrice) {
          return itemSum + ((item.originalPrice - item.discountedPrice) * item.quantity);
        }
        return itemSum;
      }, 0);
    }, 0);

    // Calculate total coupon deductions
    const totalCouponDeductions = orders.reduce((sum, order) => {
      return sum + (order.couponDiscount || 0);
    }, 0);

    // Calculate total discounts (offers + coupons)
    const totalDiscounts = totalOfferDiscounts + totalCouponDeductions;

    // Prepare order details for table
    const orderDetails = orders.map(order => ({
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      customerName: order.user?.name || 'N/A',
      customerEmail: order.user?.email || 'N/A',
      totalAmount: order.totalAmount,
      orderStatus: order.orderStatus,
      paymentMethod: order.paymentMethod,
      couponDiscount: order.couponDiscount || 0,
      offerDiscount: order.items.reduce((sum, item) => {
        if (item.hasOffer && item.originalPrice && item.discountedPrice) {
          return sum + ((item.originalPrice - item.discountedPrice) * item.quantity);
        }
        return sum;
      }, 0),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0)
    }));

    // Group orders by date for chart data
    const dailySales = {};
    orders.forEach(order => {
      const dateKey = formatDate(order.orderDate, 'YYYY-MM-DD');
      if (!dailySales[dateKey]) {
        dailySales[dateKey] = {
          date: dateKey,
          salesCount: 0,
          salesAmount: 0
        };
      }
      dailySales[dateKey].salesCount += 1;
      dailySales[dateKey].salesAmount += order.totalAmount;
    });

    const chartData = Object.values(dailySales).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      success: true,
      data: {
        reportTitle,
        filterType,
        dateRange: {
          startDate: dateFilter.orderDate?.$gte,
          endDate: dateFilter.orderDate?.$lte
        },
        metrics: {
          totalSalesCount,
          totalSalesAmount,
          totalOfferDiscounts,
          totalCouponDeductions,
          totalDiscounts,
          averageOrderValue: totalSalesCount > 0 ? totalSalesAmount / totalSalesCount : 0
        },
        orders: orderDetails,
        chartData
      }
    });

  } catch (error) {
    console.error('Error getting sales data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales data'
    });
  }
});

/**
 * Export sales report as PDF
 */
export const exportSalesReportPDF = catchAsyncError(async (req, res, next) => {
  try {
    const { filterType, startDate, endDate, selectedDate, selectedWeek, selectedMonth } = req.query;
    
    // Get the same data as the main report
    const salesDataResponse = await getSalesDataInternal({
      filterType, startDate, endDate, selectedDate, selectedWeek, selectedMonth
    });

    if (!salesDataResponse.success) {
      return res.status(400).json(salesDataResponse);
    }

    const { data } = salesDataResponse;

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sales-report-${formatDate(new Date(), 'YYYY-MM-DD')}.pdf"`);
    
    // Pipe the PDF to response
    doc.pipe(res);

    // Add header
    doc.fontSize(20).text('LUXE SCENTS', 50, 50);
    doc.fontSize(16).text('Sales Report', 50, 80);
    doc.fontSize(12).text(data.reportTitle, 50, 110);
    doc.text(`Generated on: ${formatDate(new Date(), 'MMMM DD, YYYY')} ${new Date().toLocaleTimeString()}`, 50, 130);

    // Add metrics summary
    doc.fontSize(14).text('Summary', 50, 170);
    doc.fontSize(10);
    doc.text(`Total Sales Count: ${data.metrics.totalSalesCount}`, 50, 195);
    doc.text(`Total Sales Amount: ₹${data.metrics.totalSalesAmount.toFixed(2)}`, 50, 210);
    doc.text(`Total Offer Discounts: ₹${data.metrics.totalOfferDiscounts.toFixed(2)}`, 50, 225);
    doc.text(`Total Coupon Deductions: ₹${data.metrics.totalCouponDeductions.toFixed(2)}`, 50, 240);
    doc.text(`Average Order Value: ₹${data.metrics.averageOrderValue.toFixed(2)}`, 50, 255);

    // Add orders table
    if (data.orders.length > 0) {
      doc.fontSize(12).text('Order Details', 50, 290);
      
      let yPosition = 320;
      const pageHeight = doc.page.height - 100;

      // Table headers
      doc.fontSize(8);
      doc.text('Order #', 50, yPosition);
      doc.text('Date', 120, yPosition);
      doc.text('Customer', 180, yPosition);
      doc.text('Amount', 280, yPosition);
      doc.text('Status', 340, yPosition);
      doc.text('Discount', 400, yPosition);
      
      yPosition += 20;

      // Table rows
      data.orders.forEach((order, index) => {
        if (yPosition > pageHeight) {
          doc.addPage();
          yPosition = 50;
        }

        doc.text(order.orderNumber, 50, yPosition);
        doc.text(formatDate(order.orderDate, 'MM/DD/YY'), 120, yPosition);
        doc.text(order.customerName.substring(0, 15), 180, yPosition);
        doc.text(`₹${order.totalAmount.toFixed(2)}`, 280, yPosition);
        doc.text(order.orderStatus, 340, yPosition);
        doc.text(`₹${(order.offerDiscount + order.couponDiscount).toFixed(2)}`, 400, yPosition);
        
        yPosition += 15;
      });
    }

    // Finalize the PDF
    doc.end();

  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export PDF report'
    });
  }
});

/**
 * Export sales report as Excel (CSV format)
 */
export const exportSalesReportExcel = catchAsyncError(async (req, res, next) => {
  try {
    const { filterType, startDate, endDate, selectedDate, selectedWeek, selectedMonth } = req.query;
    
    // Get the same data as the main report
    const salesDataResponse = await getSalesDataInternal({
      filterType, startDate, endDate, selectedDate, selectedWeek, selectedMonth
    });

    if (!salesDataResponse.success) {
      return res.status(400).json(salesDataResponse);
    }

    const { data } = salesDataResponse;

    // Create CSV content
    let csvContent = '';
    
    // Add header information
    csvContent += 'LUXE SCENTS - Sales Report\n';
    csvContent += `${data.reportTitle}\n`;
    csvContent += `Generated on: ${formatDate(new Date(), 'MMMM DD, YYYY')} ${new Date().toLocaleTimeString()}\n`;
    csvContent += '\n'; // Empty row

    // Add summary metrics
    csvContent += 'SUMMARY\n';
    csvContent += `Total Sales Count,${data.metrics.totalSalesCount}\n`;
    csvContent += `Total Sales Amount,₹${data.metrics.totalSalesAmount.toFixed(2)}\n`;
    csvContent += `Total Offer Discounts,₹${data.metrics.totalOfferDiscounts.toFixed(2)}\n`;
    csvContent += `Total Coupon Deductions,₹${data.metrics.totalCouponDeductions.toFixed(2)}\n`;
    csvContent += `Average Order Value,₹${data.metrics.averageOrderValue.toFixed(2)}\n`;
    csvContent += '\n'; // Empty row

    // Add order details table
    if (data.orders.length > 0) {
      csvContent += 'ORDER DETAILS\n';
      
      // Headers
      csvContent += 'Order Number,Order Date,Customer Name,Customer Email,Total Amount,Order Status,Payment Method,Offer Discount,Coupon Discount,Total Discount,Item Count\n';

      // Add data rows
      data.orders.forEach(order => {
        csvContent += `${order.orderNumber},${formatDate(order.orderDate, 'YYYY-MM-DD HH:mm')},${order.customerName},${order.customerEmail},${order.totalAmount},${order.orderStatus},${order.paymentMethod},${order.offerDiscount},${order.couponDiscount},${order.offerDiscount + order.couponDiscount},${order.itemCount}\n`;
      });
    }

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sales-report-${formatDate(new Date(), 'YYYY-MM-DD')}.csv"`);

    // Send CSV content
    res.send(csvContent);

  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export CSV report'
    });
  }
});

/**
 * Internal function to get sales data (reusable for exports)
 */
async function getSalesDataInternal(params) {
  try {
    const { filterType, startDate, endDate, selectedDate, selectedWeek, selectedMonth } = params;
    
    // Build date filter based on filter type (same logic as getSalesData)
    let dateFilter = {};
    let reportTitle = '';
    
    switch (filterType) {
      case 'daily':
        if (selectedDate) {
          const date = new Date(selectedDate);
          const startOfDay = new Date(date.setHours(0, 0, 0, 0));
          const endOfDay = new Date(date.setHours(23, 59, 59, 999));
          dateFilter = {
            orderDate: {
              $gte: startOfDay,
              $lte: endOfDay
            }
          };
          reportTitle = `Daily Report - ${formatDate(selectedDate, 'MMMM DD, YYYY')}`;
        } else {
          const today = new Date();
          const startOfDay = new Date(today.setHours(0, 0, 0, 0));
          const endOfDay = new Date(today.setHours(23, 59, 59, 999));
          dateFilter = {
            orderDate: {
              $gte: startOfDay,
              $lte: endOfDay
            }
          };
          reportTitle = `Daily Report - Today (${formatDate(new Date(), 'MMMM DD, YYYY')})`;
        }
        break;
        
      case 'weekly':
        if (selectedWeek) {
          const [year, week] = selectedWeek.split('-W');
          const startOfWeek = getStartOfWeek(parseInt(year), parseInt(week));
          const endOfWeek = getEndOfWeek(startOfWeek);
          dateFilter = {
            orderDate: {
              $gte: startOfWeek,
              $lte: endOfWeek
            }
          };
          reportTitle = `Weekly Report - Week ${week}, ${year}`;
        } else {
          const today = new Date();
          const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
          startOfWeek.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          dateFilter = {
            orderDate: {
              $gte: startOfWeek,
              $lte: endOfWeek
            }
          };
          reportTitle = `Weekly Report - Current Week`;
        }
        break;
        
      case 'monthly':
        if (selectedMonth) {
          const [year, month] = selectedMonth.split('-');
          const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
          const endOfMonth = new Date(parseInt(year), parseInt(month), 0);
          endOfMonth.setHours(23, 59, 59, 999);
          dateFilter = {
            orderDate: {
              $gte: startOfMonth,
              $lte: endOfMonth
            }
          };
          reportTitle = `Monthly Report - ${formatDate(startOfMonth, 'MMMM YYYY')}`;
        } else {
          const today = new Date();
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          endOfMonth.setHours(23, 59, 59, 999);
          dateFilter = {
            orderDate: {
              $gte: startOfMonth,
              $lte: endOfMonth
            }
          };
          reportTitle = `Monthly Report - ${formatDate(new Date(), 'MMMM YYYY')}`;
        }
        break;
        
      case 'custom':
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateFilter = {
            orderDate: {
              $gte: start,
              $lte: end
            }
          };
          reportTitle = `Custom Report - ${formatDate(startDate, 'MMM DD, YYYY')} to ${formatDate(endDate, 'MMM DD, YYYY')}`;
        } else {
          return {
            success: false,
            message: 'Start date and end date are required for custom filter'
          };
        }
        break;
        
      default:
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        dateFilter = {
          orderDate: {
            $gte: startOfMonth,
            $lte: endOfMonth
          }
        };
        reportTitle = `Monthly Report - ${formatDate(new Date(), 'MMMM YYYY')}`;
    }

    const orderStatusFilter = {
      orderStatus: { $in: ['Delivered', 'Completed'] }
    };

    const combinedFilter = { ...dateFilter, ...orderStatusFilter };

    const orders = await Order.find(combinedFilter)
      .populate('user', 'name email')
      .populate('items.product', 'productName')
      .sort({ orderDate: -1 });

    const totalSalesCount = orders.length;
    const totalSalesAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    
    const totalOfferDiscounts = orders.reduce((sum, order) => {
      return sum + order.items.reduce((itemSum, item) => {
        if (item.hasOffer && item.originalPrice && item.discountedPrice) {
          return itemSum + ((item.originalPrice - item.discountedPrice) * item.quantity);
        }
        return itemSum;
      }, 0);
    }, 0);

    const totalCouponDeductions = orders.reduce((sum, order) => {
      return sum + (order.couponDiscount || 0);
    }, 0);

    const orderDetails = orders.map(order => ({
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      customerName: order.user?.name || 'N/A',
      customerEmail: order.user?.email || 'N/A',
      totalAmount: order.totalAmount,
      orderStatus: order.orderStatus,
      paymentMethod: order.paymentMethod,
      couponDiscount: order.couponDiscount || 0,
      offerDiscount: order.items.reduce((sum, item) => {
        if (item.hasOffer && item.originalPrice && item.discountedPrice) {
          return sum + ((item.originalPrice - item.discountedPrice) * item.quantity);
        }
        return sum;
      }, 0),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0)
    }));

    return {
      success: true,
      data: {
        reportTitle,
        filterType,
        dateRange: {
          startDate: dateFilter.orderDate?.$gte,
          endDate: dateFilter.orderDate?.$lte
        },
        metrics: {
          totalSalesCount,
          totalSalesAmount,
          totalOfferDiscounts,
          totalCouponDeductions,
          totalDiscounts: totalOfferDiscounts + totalCouponDeductions,
          averageOrderValue: totalSalesCount > 0 ? totalSalesAmount / totalSalesCount : 0
        },
        orders: orderDetails
      }
    };

  } catch (error) {
    console.error('Error in getSalesDataInternal:', error);
    return {
      success: false,
      message: 'Failed to fetch sales data'
    };
  }
}