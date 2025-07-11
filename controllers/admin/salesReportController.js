import { catchAsyncError } from '../../middlewares/catchAsync.js';
import { Order } from '../../model/orderModel.js';
import { User } from '../../model/userModel.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

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


export const getSalesData = catchAsyncError(async (req, res, next) => {
  try {
    const { filterType, startDate, endDate, selectedDate, selectedWeek, selectedMonth } = req.query;
    
    
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
          
          // Validate date range
          if (start > end) {
            return res.status(400).json({
              success: false,
              message: 'Start date cannot be after end date'
            });
          }
          
          // Set proper time boundaries
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          
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

    
    const totalDiscounts = totalOfferDiscounts + totalCouponDeductions;

    
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


export const exportSalesReportPDF = catchAsyncError(async (req, res, next) => {
  try {
    const { filterType, startDate, endDate, selectedDate, selectedWeek, selectedMonth } = req.query;
    
   
    const salesDataResponse = await getSalesDataInternal({
      filterType, startDate, endDate, selectedDate, selectedWeek, selectedMonth
    });

    if (!salesDataResponse.success) {
      return res.status(400).json(salesDataResponse);
    }

    const { data } = salesDataResponse;

  
    const doc = new PDFDocument({ margin: 50 });
    
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sales-report-${formatDate(new Date(), 'YYYY-MM-DD')}.pdf"`);
    
   
    doc.pipe(res);

   
    doc.fontSize(20).text('LUXE SCENTS', 50, 50);
    doc.fontSize(16).text('Sales Report', 50, 80);
    doc.fontSize(12).text(data.reportTitle, 50, 110);
    doc.text(`Generated on: ${formatDate(new Date(), 'MMMM DD, YYYY')} ${new Date().toLocaleTimeString()}`, 50, 130);

   
    doc.fontSize(14).text('Summary', 50, 170);
    doc.fontSize(10);
    doc.text(`Total Sales Count: ${data.metrics.totalSalesCount}`, 50, 195);
    doc.text(`Total Sales Amount: ₹${data.metrics.totalSalesAmount.toFixed(2)}`, 50, 210);
    doc.text(`Total Offer Discounts: ₹${data.metrics.totalOfferDiscounts.toFixed(2)}`, 50, 225);
    doc.text(`Total Coupon Deductions: ₹${data.metrics.totalCouponDeductions.toFixed(2)}`, 50, 240);
    doc.text(`Average Order Value: ₹${data.metrics.averageOrderValue.toFixed(2)}`, 50, 255);

   
    if (data.orders.length > 0) {
      doc.fontSize(12).text('Order Details', 50, 290);
      
      let yPosition = 320;
      const pageHeight = doc.page.height - 100;

      
      doc.fontSize(8);
      doc.text('Order #', 50, yPosition);
      doc.text('Date', 120, yPosition);
      doc.text('Customer', 180, yPosition);
      doc.text('Amount', 280, yPosition);
      doc.text('Status', 340, yPosition);
      doc.text('Discount', 400, yPosition);
      
      yPosition += 20;

     
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

    
    doc.end();

  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export PDF report'
    });
  }
});


export const exportSalesReportExcel = catchAsyncError(async (req, res, next) => {
  try {
    const { filterType, startDate, endDate, selectedDate, selectedWeek, selectedMonth } = req.query;
    
    const salesDataResponse = await getSalesDataInternal({
      filterType, startDate, endDate, selectedDate, selectedWeek, selectedMonth
    });

    if (!salesDataResponse.success) {
      return res.status(400).json(salesDataResponse);
    }

    const { data } = salesDataResponse;

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Set worksheet properties
    worksheet.properties.defaultRowHeight = 20;

    // Add title and metadata
    worksheet.addRow(['LUXE SCENTS - Sales Report']);
    worksheet.addRow([data.reportTitle]);
    worksheet.addRow([`Generated on: ${formatDate(new Date(), 'MMMM DD, YYYY')} ${new Date().toLocaleTimeString()}`]);
    worksheet.addRow([]); // Empty row

    // Style the title
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A2').font = { size: 14, bold: true };
    worksheet.getCell('A3').font = { size: 12 };

    // Add summary section
    worksheet.addRow(['SUMMARY']);
    worksheet.addRow(['Total Sales Count', data.metrics.totalSalesCount]);
    worksheet.addRow(['Total Sales Amount', data.metrics.totalSalesAmount.toFixed(2)]);
    worksheet.addRow(['Total Offer Discounts', data.metrics.totalOfferDiscounts.toFixed(2)]);
    worksheet.addRow(['Total Coupon Deductions', data.metrics.totalCouponDeductions.toFixed(2)]);
    worksheet.addRow(['Average Order Value', data.metrics.averageOrderValue.toFixed(2)]);
    worksheet.addRow([]); // Empty row

    // Style summary section
    const summaryRow = worksheet.getRow(5);
    summaryRow.font = { bold: true };
    summaryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE7E6E6' }
    };

    // Add order details if available
    if (data.orders.length > 0) {
      worksheet.addRow(['ORDER DETAILS']);
      
      // Add headers
      const headerRow = worksheet.addRow([
        'Order Number',
        'Order Date',
        'Customer Name',
        'Customer Email',
        'Total Amount',
        'Order Status',
        'Payment Method',
        'Offer Discount',
        'Coupon Discount',
        'Total Discount',
        'Item Count'
      ]);

      // Style header row
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };

      // Add order data rows
      data.orders.forEach(order => {
        worksheet.addRow([
          order.orderNumber,
          formatDate(order.orderDate, 'YYYY-MM-DD HH:mm'),
          order.customerName,
          order.customerEmail,
          order.totalAmount.toFixed(2),
          order.orderStatus,
          order.paymentMethod,
          order.offerDiscount.toFixed(2),
          order.couponDiscount.toFixed(2),
          (order.offerDiscount + order.couponDiscount).toFixed(2),
          order.itemCount
        ]);
      });

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      });

      // Add borders to data table
      const dataStartRow = worksheet.rowCount - data.orders.length;
      const dataEndRow = worksheet.rowCount;
      const dataStartCol = 1;
      const dataEndCol = 11;

      for (let row = dataStartRow - 1; row <= dataEndRow; row++) {
        for (let col = dataStartCol; col <= dataEndCol; col++) {
          const cell = worksheet.getCell(row, col);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      }
    }

    // Set response headers for Excel file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="sales-report-${formatDate(new Date(), 'YYYY-MM-DD')}.xlsx"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error exporting Excel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export Excel report'
    });
  }
});


async function getSalesDataInternal(params) {
  try {
    const { filterType, startDate, endDate, selectedDate, selectedWeek, selectedMonth } = params;
    
  
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