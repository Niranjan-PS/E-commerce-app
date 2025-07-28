# E-Commerce Cart & Checkout Calculations Guide

## Table of Contents
1. [Overview](#overview)
2. [Product Pricing System](#product-pricing-system)
3. [Cart Calculations](#cart-calculations)
4. [Offer System](#offer-system)
5. [Coupon System](#coupon-system)
6. [Order Summary Calculations](#order-summary-calculations)
7. [Wallet System](#wallet-system)
8. [Tax & Shipping](#tax--shipping)
9. [Examples](#examples)

---

## Overview

This e-commerce application implements a sophisticated pricing and calculation system that handles:
- **Product pricing** with regular and sale prices
- **Dynamic offer system** (product-specific and category-wide offers)
- **Coupon discounts** with various conditions
- **Tax calculations** (GST)
- **Shipping charges** with free shipping thresholds
- **Wallet payments** and transactions

---

## Product Pricing System

### Base Price Structure
Each product has the following price fields:
- **`price`**: Original/regular price of the product
- **`salePrice`**: Discounted price set by admin (optional)
- **`discount`**: Percentage discount for display purposes

### Price Priority Logic
The system determines the final price using this hierarchy:
1. **Active Offers** (highest priority)
2. **Sale Price** (if no active offers)
3. **Regular Price** (fallback)

```javascript
// Example Product
{
  price: 1000,        // Regular price
  salePrice: 800,     // Sale price (20% off)
  discount: 20        // Display discount percentage
}
```

---

## Cart Calculations

### Cart Item Structure
Each cart item stores comprehensive pricing information:

```javascript
{
  product: ObjectId,
  quantity: 2,
  price: 1000,              // Original product price
  salePrice: 800,           // Product sale price
  originalPrice: 1000,      // Price before any offers
  discountedPrice: 750,     // Final price after best offer
  offerSavings: 250,        // Savings from offers per item
  hasOffer: true,           // Whether offer is applied
  offerDetails: {           // Details of applied offer
    name: "Summer Sale",
    discountPercentage: 25,
    type: "category"
  }
}
```

### Cart Totals Calculation

The cart automatically calculates these totals:

```javascript
calculateTotals() {
  let totalItems = 0;
  let totalPrice = 0;        // Sum of (originalPrice × quantity)
  let totalSalePrice = 0;    // Sum of (discountedPrice × quantity)
  let totalSavings = 0;      // Sum of (offerSavings × quantity)

  this.items.forEach(item => {
    totalItems += item.quantity;
    totalPrice += item.originalPrice * item.quantity;
    totalSalePrice += item.discountedPrice * item.quantity;
    totalSavings += item.offerSavings * item.quantity;
  });
}
```

### Example Cart Calculation
```
Cart Items:
- Product A: ₹1000 × 2 = ₹2000 (with 25% offer = ₹1500)
- Product B: ₹500 × 1 = ₹500 (no offer)

Cart Totals:
- totalItems: 3
- totalPrice: ₹2500 (original prices)
- totalSalePrice: ₹2000 (after offers)
- totalSavings: ₹500
```

---

## Offer System

### Offer Types
1. **Product Offers**: Applied to specific products
2. **Category Offers**: Applied to all products in a category

### Offer Calculation Logic

```javascript
async function calculateBestOfferPrice(product) {
  // 1. Find active product offer
  const productOffer = await ProductOffer.findActiveOfferForProduct(product._id);
  
  // 2. Find active category offer
  const categoryOffer = await CategoryOffer.findActiveOfferForCategory(product.category._id);
  
  // 3. Choose the best offer (highest discount percentage)
  const bestOffer = Math.max(
    productOffer?.discountPercentage || 0,
    categoryOffer?.discountPercentage || 0
  );
  
  // 4. Calculate discounted price
  if (bestOffer > 0) {
    const discountAmount = (originalPrice * bestOffer) / 100;
    discountedPrice = originalPrice - discountAmount;
  } else {
    // Use sale price if available, otherwise regular price
    discountedPrice = product.salePrice || product.price;
  }
}
```

### Offer Priority Example
```
Product: Perfume X (₹1000)
- Product Offer: 20% off
- Category Offer: 25% off

Result: Category offer applied (25% > 20%)
Final Price: ₹1000 - (₹1000 × 25%) = ₹750
Savings: ₹250
```

---

## Coupon System

### Coupon Types
- **Percentage**: Discount as percentage of cart total
- **Fixed**: Fixed amount discount

### Coupon Properties
```javascript
{
  code: "SAVE20",
  discountType: "percentage",    // or "fixed"
  discountValue: 20,             // 20% or ₹20
  minimumAmount: 500,            // Minimum cart value
  maximumDiscount: 200,          // Max discount cap (for percentage)
  usageLimit: 100,               // Total usage limit
  validFrom: Date,
  validUntil: Date,
  applicableCategories: [],      // Specific categories
  applicableProducts: []         // Specific products
}
```

### Coupon Discount Calculation

```javascript
calculateDiscount(cartTotal) {
  // Check validity and minimum amount
  if (!this.isValid() || cartTotal < this.minimumAmount) {
    return 0;
  }
  
  let discount = 0;
  
  if (this.discountType === 'percentage') {
    discount = (cartTotal * this.discountValue) / 100;
    
    // Apply maximum discount cap
    if (this.maximumDiscount && discount > this.maximumDiscount) {
      discount = this.maximumDiscount;
    }
  } else {
    // Fixed amount discount
    discount = this.discountValue;
  }
  
  // Discount cannot exceed cart total
  return Math.min(discount, cartTotal);
}
```

### Coupon Examples

**Percentage Coupon:**
```
Code: SAVE20
Type: percentage
Value: 20%
Min Amount: ₹500
Max Discount: ₹200

Cart Total: ₹1000
Discount: min(₹1000 × 20%, ₹200) = ₹200
```

**Fixed Coupon:**
```
Code: FLAT100
Type: fixed
Value: ₹100
Min Amount: ₹300

Cart Total: ₹500
Discount: ₹100
```

---

## Order Summary Calculations

### Tax Configuration
```javascript
const TAX_CONFIG = {
  GST_RATE: 18,                    // 18% GST
  SHIPPING_CHARGE: 50,             // ₹50 shipping
  FREE_SHIPPING_THRESHOLD: 1000    // Free shipping above ₹1000
};
```

### Order Summary Formula

```javascript
function calculateOrderSummary(cart, couponDiscount = 0) {
  const subtotal = cart.totalSalePrice;           // After offers
  const savings = cart.totalSavings;              // Offer savings
  
  const tax = Math.round((subtotal * 18) / 100);  // 18% GST
  
  const shipping = subtotal >= 1000 ? 0 : 50;     // Free shipping logic
  
  const total = subtotal + tax + shipping - couponDiscount;
  
  return {
    subtotal,           // Cart total after offers
    savings,            // Total offer savings
    couponDiscount,     // Coupon discount amount
    tax,                // GST amount
    shipping,           // Shipping charges
    total: Math.max(total, 0),  // Final total (minimum 0)
    finalTotal: Math.max(total, 0)
  };
}
```

---

## Wallet System

### Wallet Structure
```javascript
{
  userId: ObjectId,
  balance: 1500.00,
  transactions: [
    {
      transactionId: "TRN-1234567890-abc123",
      description: "Payment for Order #ORD-001",
      amount: -500.00,        // Negative for debit
      date: Date
    },
    {
      transactionId: "REF_1234567890_userId",
      description: "Referral bonus",
      amount: +100.00,        // Positive for credit
      date: Date
    }
  ]
}
```

### Wallet Payment Process
1. **Validation**: Check if wallet balance ≥ order total
2. **Deduction**: Subtract order amount from wallet
3. **Transaction Record**: Add transaction entry
4. **Order Update**: Mark order as paid

```javascript
// Wallet payment example
if (walletBalance >= orderTotal) {
  wallet.balance -= orderTotal;
  wallet.transactions.push({
    transactionId: generateTransactionId(),
    description: `Payment for Order #${orderNumber}`,
    amount: -orderTotal,
    date: new Date()
  });
}
```

---

## Tax & Shipping

### GST Calculation
- **Rate**: 18% on subtotal (after offers, before coupon)
- **Formula**: `tax = Math.round((subtotal × 18) / 100)`

### Shipping Logic
```javascript
const shipping = subtotal >= 1000 ? 0 : 50;

// Examples:
// Cart ₹800 → Shipping ₹50
// Cart ₹1200 → Shipping ₹0 (FREE)
```

---

## Examples

### Complete Order Example

**Cart Items:**
```
1. Perfume A: ₹1000 × 2 = ₹2000
   - Category Offer: 20% off
   - Final: ₹1600 (Save ₹400)

2. Perfume B: ₹500 × 1 = ₹500
   - No offers
   - Final: ₹500
```

**Cart Totals:**
```
Total Items: 3
Original Total: ₹2500
After Offers: ₹2100
Total Savings: ₹400
```

**Applied Coupon:**
```
Code: SAVE10
Type: percentage
Value: 10%
Coupon Discount: ₹2100 × 10% = ₹210
```

**Order Summary:**
```
Subtotal (after offers):     ₹2100
Product Savings:            -₹400
Coupon Discount (SAVE10):   -₹210
Tax (18% GST):              +₹378   (₹2100 × 18%)
Shipping:                   +₹0     (Free - above ₹1000)
─────────────────────────────────
Final Total:                ₹2268
```

### Wallet Payment Example

**Scenario:**
- Order Total: ₹2268
- Wallet Balance: ₹3000

**Process:**
1. Validate: ₹3000 ≥ ₹2268 ✓
2. Deduct: ₹3000 - ₹2268 = ₹732 (new balance)
3. Record transaction:
   ```javascript
   {
     transactionId: "TRN-1640995200-xyz789",
     description: "Payment for Order #ORD-12345",
     amount: -2268.00,
     date: "2024-01-15T10:30:00Z"
   }
   ```

### COD Restrictions

**Rules:**
- COD allowed only for orders ≤ ₹1000
- Orders > ₹1000 must use Online Payment or Wallet

**Examples:**
```
Order ₹800  → COD ✓, Online ✓, Wallet ✓
Order ₹1200 → COD ✗, Online ✓, Wallet ✓
```

---

## Key Features

### Real-time Updates
- Cart subtotals update instantly when quantity changes
- Offer calculations refresh automatically
- Stock validation before checkout

### Price Display
- All wallet amounts rounded to 2 decimal places
- Currency formatting with Indian locale
- Clear breakdown of savings and discounts

### Validation
- Stock availability checks
- Coupon validity verification
- Minimum order amount validation
- Payment method restrictions

### Error Handling
- Graceful fallbacks for offer calculation failures
- Stock reservation with rollback on failure
- Session management for applied coupons

---

This comprehensive calculation system ensures accurate pricing, transparent cost breakdown, and seamless user experience throughout the shopping journey.