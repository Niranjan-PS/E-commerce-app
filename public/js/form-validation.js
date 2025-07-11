 // Form validation error removal utility
document.addEventListener('DOMContentLoaded', function() {
    // Get all form inputs
    const formInputs = document.querySelectorAll('input, select, textarea');
    
    formInputs.forEach(input => {
        // Add event listeners for various input events
        input.addEventListener('input', clearErrorOnInput);
        input.addEventListener('change', clearErrorOnInput);
        input.addEventListener('focus', clearErrorOnInput);
    });
    
    function clearErrorOnInput(event) {
        const input = event.target;
        
        // Find associated error messages
        const errorElements = findErrorElements(input);
        
        // Remove error styling and messages if input is valid
        if (isInputValid(input)) {
            // Remove error classes
            input.classList.remove('is-invalid', 'error', 'border-danger');
            input.classList.add('is-valid');
            
            // Hide error messages
            errorElements.forEach(errorElement => {
                errorElement.style.display = 'none';
                errorElement.textContent = '';
            });
            
            // Remove error styling from parent elements
            const formGroup = input.closest('.form-group, .mb-3, .col');
            if (formGroup) {
                const errorTexts = formGroup.querySelectorAll('.invalid-feedback, .error-message, .text-danger');
                errorTexts.forEach(errorText => {
                    errorText.style.display = 'none';
                    errorText.textContent = '';
                });
            }
        } else {
            // Remove valid class if input becomes invalid
            input.classList.remove('is-valid');
        }
    }
    
    function findErrorElements(input) {
        const errorElements = [];
        
        // Look for error elements by various selectors
        const selectors = [
            `#${input.id}-error`,
            `[data-error-for="${input.name}"]`,
            `[data-error-for="${input.id}"]`
        ];
        
        selectors.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                errorElements.push(element);
            }
        });
        
        // Look for error elements in the same form group
        const formGroup = input.closest('.form-group, .mb-3, .col');
        if (formGroup) {
            const errorTexts = formGroup.querySelectorAll('.invalid-feedback, .error-message, .text-danger');
            errorTexts.forEach(errorText => {
                errorElements.push(errorText);
            });
        }
        
        // Look for sibling error elements
        const nextSibling = input.nextElementSibling;
        if (nextSibling && (nextSibling.classList.contains('invalid-feedback') || 
                          nextSibling.classList.contains('error-message') || 
                          nextSibling.classList.contains('text-danger'))) {
            errorElements.push(nextSibling);
        }
        
        return errorElements;
    }
    
    function isInputValid(input) {
        // Basic validation checks
        if (input.hasAttribute('required') && !input.value.trim()) {
            return false;
        }
        
        // Email validation
        if (input.type === 'email' && input.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(input.value);
        }
        
        // Phone validation
        if (input.type === 'tel' && input.value) {
            const phoneRegex = /^\+91\d{10}$/;
            return phoneRegex.test(input.value);
        }
        
        // Password validation
        if (input.type === 'password' && input.value) {
            return input.value.length >= 8;
        }
        
        // Number validation
        if (input.type === 'number' && input.value) {
            const num = parseFloat(input.value);
            const min = input.hasAttribute('min') ? parseFloat(input.getAttribute('min')) : -Infinity;
            const max = input.hasAttribute('max') ? parseFloat(input.getAttribute('max')) : Infinity;
            return !isNaN(num) && num >= min && num <= max;
        }
        
        // Pattern validation
        if (input.hasAttribute('pattern') && input.value) {
            const pattern = new RegExp(input.getAttribute('pattern'));
            return pattern.test(input.value);
        }
        
        // Min/Max length validation
        if (input.value) {
            const minLength = input.hasAttribute('minlength') ? parseInt(input.getAttribute('minlength')) : 0;
            const maxLength = input.hasAttribute('maxlength') ? parseInt(input.getAttribute('maxlength')) : Infinity;
            return input.value.length >= minLength && input.value.length <= maxLength;
        }
        
        // If no specific validation rules, consider it valid if it has a value or is not required
        return input.value.trim() !== '' || !input.hasAttribute('required');
    }
    
    // Handle form submission to prevent submission if there are errors
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(event) {
            let hasErrors = false;
            
            // Check all inputs in the form
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                if (!isInputValid(input)) {
                    hasErrors = true;
                    input.classList.add('is-invalid');
                    input.classList.remove('is-valid');
                }
            });
            
            // If there are errors, prevent submission
            if (hasErrors) {
                event.preventDefault();
                
                // Show a general error message
                const firstInvalidInput = form.querySelector('.is-invalid');
                if (firstInvalidInput) {
                    firstInvalidInput.focus();
                    
                    // Show SweetAlert if available
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'error',
                            title: 'Validation Error',
                            text: 'Please correct the errors in the form before submitting.',
                            confirmButtonColor: '#6200ea'
                        });
                    }
                }
            }
        });
    });
});

// Export for use in other scripts
window.FormValidation = {
    clearErrors: function(formSelector) {
        const form = document.querySelector(formSelector);
        if (form) {
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.classList.remove('is-invalid', 'error', 'border-danger');
                input.classList.remove('is-valid');
            });
            
            const errorElements = form.querySelectorAll('.invalid-feedback, .error-message, .text-danger');
            errorElements.forEach(errorElement => {
                errorElement.style.display = 'none';
                errorElement.textContent = '';
            });
        }
    },
    
    showError: function(inputSelector, message) {
        const input = document.querySelector(inputSelector);
        if (input) {
            input.classList.add('is-invalid');
            input.classList.remove('is-valid');
            
            // Find or create error element
            let errorElement = input.nextElementSibling;
            if (!errorElement || !errorElement.classList.contains('invalid-feedback')) {
                errorElement = document.createElement('div');
                errorElement.className = 'invalid-feedback';
                input.parentNode.insertBefore(errorElement, input.nextSibling);
            }
            
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }
};