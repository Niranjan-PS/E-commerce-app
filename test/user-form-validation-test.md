# User Form Validation with Underscore Rules - Test Guide

## Overview
This guide provides comprehensive testing instructions for the newly implemented client-side validations across all user forms with specific underscore validation rules.

## Underscore Validation Rules

### ✅ **Registration Form** - Underscores ALLOWED
- **Location**: `/register`
- **Username Field**: Allows letters, spaces, and underscores
- **Email Field**: Allows underscores (for registration only)
- **Password Field**: Allows underscores in special characters

### ❌ **All Other Forms** - Underscores NOT ALLOWED
- **Login Form**: No underscores in email or password
- **Forgot Password**: No underscores in email
- **Reset Password**: No underscores in password
- **Edit Profile**: No underscores in name or phone
- **Change Password**: No underscores in any password field
- **Address Forms**: No underscores in any address field

## Form-by-Form Testing

### 1. Registration Form (`/register`)

#### Test 1.1: Username Validation (Underscores ALLOWED)
1. Navigate to `/register`
2. Test username field with:
   - ✅ "john_doe" → Should be accepted
   - ✅ "user_name_123" → Should be accepted
   - ✅ "John Smith" → Should be accepted
   - ❌ "_username" → Should show error (cannot start with underscore)
   - ❌ "username_" → Should show error (cannot end with underscore)
   - ❌ "user__name" → Should show error (consecutive underscores)
   - ❌ "123user" → Should show error (must start with letter)

#### Test 1.2: Email Validation (Underscores ALLOWED)
1. Test email field with:
   - ✅ "user_name@example.com" → Should be accepted
   - ✅ "test_email@domain.co.in" → Should be accepted
   - ❌ "user..name@example.com" → Should show error (consecutive dots)

#### Test 1.3: Password Validation (Comprehensive)
1. Test password field with:
   - ✅ "Password_123!" → Should be accepted
   - ❌ "password" → Should show error (missing uppercase, number, special char)
   - ❌ "PASSWORD" → Should show error (missing lowercase, number, special char)
   - ❌ "Password 123" → Should show error (contains space)
   - ❌ "Pass" → Should show error (too short)

### 2. Login Form (`/login`)

#### Test 2.1: Email Validation (Underscores NOT ALLOWED)
1. Navigate to `/login`
2. Test email field with:
   - ❌ "user_name@example.com" → Should show SweetAlert error
   - ✅ "username@example.com" → Should be accepted
   - **Expected Error**: "Email addresses with underscores are not allowed in login"

#### Test 2.2: Password Validation (Underscores NOT ALLOWED)
1. Test password field with:
   - ❌ "Password_123!" → Should show SweetAlert error
   - ✅ "Password123!" → Should be accepted
   - **Expected Error**: "Password cannot contain underscores"

### 3. Forgot Password Form (`/forgot-password`)

#### Test 3.1: Email Validation (Underscores NOT ALLOWED)
1. Navigate to `/forgot-password`
2. Test email field with:
   - ❌ "user_email@example.com" → Should show SweetAlert error
   - ✅ "useremail@example.com" → Should be accepted
   - **Expected Error**: "Email addresses with underscores are not supported for password recovery"

### 4. Reset Password Form (`/reset-password/{token}`)

#### Test 4.1: Password Validation (Underscores NOT ALLOWED)
1. Navigate to reset password page
2. Test new password field with:
   - ❌ "NewPassword_123!" → Should show SweetAlert error
   - ✅ "NewPassword123!" → Should be accepted
   - **Expected Error**: "New password cannot contain underscores"

### 5. Edit Profile Form (`/profile/edit`)

#### Test 5.1: Name Validation (Underscores NOT ALLOWED)
1. Navigate to `/profile/edit`
2. Test name field with:
   - ❌ "John_Doe" → Should show SweetAlert error and auto-remove underscore
   - ✅ "John Doe" → Should be accepted
   - **Expected Error**: "Name cannot contain underscores"

#### Test 5.2: Phone Validation (Underscores NOT ALLOWED)
1. Test phone field with:
   - ❌ "+91_9876543210" → Should show SweetAlert error and auto-remove underscore
   - ✅ "+919876543210" → Should be accepted

### 6. Change Password Form (`/profile/change-password`)

#### Test 6.1: All Password Fields (Underscores NOT ALLOWED)
1. Navigate to `/profile/change-password`
2. Test all password fields with:
   - ❌ "Current_Password123!" → Should show SweetAlert error
   - ❌ "New_Password123!" → Should show SweetAlert error
   - ✅ "CurrentPassword123!" → Should be accepted
   - **Expected Error**: "Passwords with underscores are not supported"

### 7. Address Forms (`/addresses/add`, `/addresses/edit/{id}`)

#### Test 7.1: All Address Fields (Underscores NOT ALLOWED)
1. Navigate to add/edit address page
2. Test all text fields with underscores:
   - ❌ "Home_Address" (title) → Should show SweetAlert error and auto-remove
   - ❌ "John_Doe" (name) → Should show SweetAlert error and auto-remove
   - ❌ "Main_Street" (street) → Should show SweetAlert error and auto-remove
   - ❌ "New_Delhi" (city) → Should show SweetAlert error and auto-remove
   - ❌ "Tamil_Nadu" (state) → Should show SweetAlert error and auto-remove

## SweetAlert Error Messages

### Registration Form Messages
- Username errors: Standard validation messages
- Email errors: Standard email validation messages
- Password errors: Comprehensive strength requirements

### Other Forms Messages
- **Underscore in Email**: "Email addresses with underscores are not allowed in login"
- **Underscore in Password**: "Password cannot contain underscores. Please use other special characters"
- **Underscore in Name**: "Name cannot contain underscores. Please use only letters and spaces"
- **Underscore in Address**: "[Field] cannot contain underscores. Please remove them and try again"

## Auto-Correction Features

### Forms with Auto-Correction
- **Edit Profile**: Automatically removes underscores from name and phone
- **Address Forms**: Automatically removes underscores from all text fields

### Forms with Error-Only
- **Login**: Shows error, requires manual correction
- **Forgot Password**: Shows error, requires manual correction
- **Reset Password**: Shows error, requires manual correction
- **Change Password**: Shows error, requires manual correction

## Additional Validation Features

### Email Validation (All Forms)
- Format validation: `user@domain.com`
- Length validation: Max 254 characters
- No consecutive dots: `user..name@domain.com` ❌
- No dots around @: `user.@domain.com` or `user@.domain.com` ❌

### Password Validation (All Forms)
- Length: 8-128 characters
- Must contain: lowercase, uppercase, number, special character
- No spaces allowed
- No more than 2 consecutive identical characters
- Special characters allowed: `@$!%*?&-` (no underscore except registration)

### Phone Validation (All Forms)
- Format: `+91XXXXXXXXXX`
- Must start with 6, 7, 8, or 9 after +91
- Exactly 10 digits after +91

### Name Validation (Profile/Address Forms)
- Only letters and spaces
- No underscores (except registration username)
- No multiple consecutive spaces
- Cannot start/end with spaces

## Manual Testing Checklist

### Registration Form
- [ ] Username allows underscores
- [ ] Email allows underscores
- [ ] Password allows underscores in special chars
- [ ] All other validations work correctly

### Login Form
- [ ] Email rejects underscores with SweetAlert
- [ ] Password rejects underscores with SweetAlert
- [ ] Other validations work correctly

### Forgot Password Form
- [ ] Email rejects underscores with SweetAlert
- [ ] Proper error message displayed

### Reset Password Form
- [ ] New password rejects underscores with SweetAlert
- [ ] Confirm password validation works
- [ ] Password strength validation works

### Edit Profile Form
- [ ] Name rejects underscores with auto-removal
- [ ] Phone rejects underscores with auto-removal
- [ ] SweetAlert errors display correctly

### Change Password Form
- [ ] All password fields reject underscores
- [ ] Current password validation works
- [ ] New password strength validation works
- [ ] Password match validation works

### Address Forms
- [ ] All text fields reject underscores with auto-removal
- [ ] Phone validation works correctly
- [ ] ZIP code validation works correctly
- [ ] Required field validation works

## Browser Compatibility
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Expected Behavior Summary

1. **Registration**: Underscores allowed in username and email
2. **All Other Forms**: Underscores blocked with SweetAlert errors
3. **Auto-Correction**: Profile and address forms auto-remove underscores
4. **Consistent UX**: Professional SweetAlert messages throughout
5. **No Backend Changes**: All validation is client-side only
6. **Comprehensive**: Covers all user-facing forms

This validation system ensures data consistency while providing clear guidance to users about underscore usage across different forms.
