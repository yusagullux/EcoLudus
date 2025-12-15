// ============================================
// ECOQUEST UTILITY FUNCTIONS – SHARED FUNCTIONS
// ============================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_DISPLAY_NAME_LENGTH = 50;
const MIN_DISPLAY_NAME_LENGTH = 2;

// e-posti valideerimine, kontrollib et e-post on kehtiv enne andmebaasi salvestamist
export function validateEmail(email) {
    // kontrollib, et e-post on olemas ja string tüüpi
    if (!email || typeof email !== 'string') {
        return { valid: false, error: 'Email is required' };
    }
    
    const cleanedEmail = email.trim().toLowerCase();
    const maxEmailLength = 254;
    
    // kontrollib e-posti formaati regex abil
    if (!EMAIL_REGEX.test(cleanedEmail)) {
        return { valid: false, error: 'Please enter a valid email address' };
    }
    
    // kontrollib e-posti pikkust 
    if (cleanedEmail.length > maxEmailLength) {
        return { valid: false, error: 'Email is too long' };
    }
    
    return { valid: true, email: cleanedEmail };
}

// tagab turvalisuse, kontrollib parooli pikkust
export function validatePassword(password) {
    // kontrollib, et parool on olemas ja string tüüpi
    if (!password || typeof password !== 'string') {
        return { valid: false, error: 'Password is required' };
    }
    
    const maxPasswordLength = 128;
    
    // kontrollib minimaalset pikkust (Firebase nõue: vähemalt 6 tähemärki)
    if (password.length < MIN_PASSWORD_LENGTH) {
        return { 
            valid: false, 
            error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long` 
        };
    }
    
    // kontrollib maksimaalset pikkust (vältib liiga pikkade paroolide salvestamist)
    if (password.length > maxPasswordLength) {
        return { valid: false, error: 'Password is too long' };
    }
    
    return { valid: true };
}

export function validateDisplayName(displayName) {
    if (!displayName || typeof displayName !== 'string') {
        return { valid: false, error: 'Display name is required' };
    }
    
    const trimmedName = displayName.trim();
    
    if (trimmedName.length < MIN_DISPLAY_NAME_LENGTH) {
        return { 
            valid: false, 
            error: `Display name must be at least ${MIN_DISPLAY_NAME_LENGTH} characters long` 
        };
    }
    
    if (trimmedName.length > MAX_DISPLAY_NAME_LENGTH) {
        return { 
            valid: false, 
            error: `Display name must be less than ${MAX_DISPLAY_NAME_LENGTH} characters` 
        };
    }
    
    const sanitizedName = sanitizeInput(trimmedName);
    
    return { valid: true, displayName: sanitizedName };
}

// Sisendi puhastamine
export function sanitizeInput(input) {
    // kontrollib, et sisend on string
    if (typeof input !== 'string') {
        return '';
    }
    
    const maxInputLength = 200;
    const dangerousHtmlChars = /[<>]/g;
    
    // eemaldab HTML märgid (< ja >), et vältida XSS rünnakuid
    return input
        .trim()
        .replace(dangerousHtmlChars, '')
        .substring(0, maxInputLength);
}

// veateate vormindamine
export function formatErrorMessage(error) {
    // kontrollib, et viga on olemas
    if (!error) {
        return 'An unexpected error occurred. Please try again.';
    }
    
    // kontrollib esmalt error.code välja
    const errorCode = error.code || '';
    const errorMessage = error.message || error.toString();
    
    // kasutajasõbralikud veateated
    const userFriendlyMessages = {
        'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/weak-password': 'Password is too weak. Please choose a stronger password.',
        'auth/user-not-found': 'No account found with this email address.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/invalid-credential': 'Invalid email or password. Please check your credentials and try again.',
        'auth/invalid-login-credentials': 'Invalid email or password. Please check your credentials and try again.',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
        'auth/network-request-failed': 'Network error. Please check your connection and try again.',
        'auth/user-disabled': 'This account has been disabled. Please contact support.',
        'auth/operation-not-allowed': 'This sign-in method is not enabled.',
        'permission-denied': 'You do not have permission to perform this action.',
        'unavailable': 'Service is temporarily unavailable. Please try again later.'
    };
    
    // kontrollib esmalt error.code väärtust
    if (errorCode && userFriendlyMessages[errorCode]) {
        return userFriendlyMessages[errorCode];
    }
    
    // kontrollib seejärel error.message sisu
    for (const [key, message] of Object.entries(userFriendlyMessages)) {
        if (errorMessage.includes(key)) {
            return message;
        }
    }
    
    // tagastab üldise sõnumi, kui sobivat viga ei leitud
    return 'Invalid email or password. Please check your credentials and try again.';
}

export function checkOnlineStatus() {
    return navigator.onLine;
}

export function setupOfflineDetection(callback) {
    window.addEventListener('online', () => {
        if (callback) callback(true);
    });
    
    window.addEventListener('offline', () => {
        if (callback) callback(false);
    });
    
    return navigator.onLine;
}

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

export function formatNumber(number) {
    if (typeof number !== 'number') {
        return '0';
    }
    
    return number.toLocaleString('en-US');
}

export function getErrorMessage(error) {
    if (error && error.message) {
        return formatErrorMessage(error);
    }
    
    if (typeof error === 'string') {
        return error;
    }
    
    return 'An unexpected error occurred. Please try again.';
}

