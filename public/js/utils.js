const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_DISPLAY_NAME_LENGTH = 50;
const MIN_DISPLAY_NAME_LENGTH = 2;

export function validateEmail(email) {
    // Kontrollib e-posti olemasolu ja tüüpi
    if (!email || typeof email !== 'string') {
        return { valid: false, error: 'Email is required' };
    }

    // Normaliseerib e-posti aadressi
    const cleanedEmail = email.trim().toLowerCase();
    const maxEmailLength = 254;

    // Kontrollib e-posti formaati regex abil
    if (!EMAIL_REGEX.test(cleanedEmail)) {
        return { valid: false, error: 'Please enter a valid email address' };
    }

    // Kontrollib pikkust
    if (cleanedEmail.length > maxEmailLength) {
        return { valid: false, error: 'Email is too long' };
    }

    return { valid: true, email: cleanedEmail };
}

// Kontrollib parooli turvalisust ja pikkust
export function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return { valid: false, error: 'Password is required' };
    }

    const maxPasswordLength = 128;

    // Kontrollib minimaalset pikkust (Firebase nõue: vähemalt 6 sümbolit)
    if (password.length < MIN_PASSWORD_LENGTH) {
        return {
            valid: false,
            error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`
        };
    }

    // Kontrollib maksimaalset pikkust
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

// Sisendi puhastamine XSS rünnakute vältimiseks
export function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return '';
    }

    const maxInputLength = 200;
    const dangerousHtmlChars = /[<>]/g;

    // Eemaldab ohtlikud HTML sümbolid
    return input
        .trim()
        .replace(dangerousHtmlChars, '')
        .substring(0, maxInputLength);
}

// Vormindab veateate kasutajasõbralikuks
export function formatErrorMessage(error) {
    if (!error) {
        return 'An unexpected error occurred. Please try again.';
    }

    const errorCode = error.code || '';
    const errorMessage = error.message || error.toString();

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

    if (errorCode && userFriendlyMessages[errorCode]) {
        return userFriendlyMessages[errorCode];
    }

    for (const [key, message] of Object.entries(userFriendlyMessages)) {
        if (errorMessage.includes(key)) {
            return message;
        }
    }

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
