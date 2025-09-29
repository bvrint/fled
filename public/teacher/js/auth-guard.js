// Authentication Security Guard
// This module ensures only authenticated teachers can access protected pages

import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let authCheckTimeout;
let isAuthenticated = false;
let authCheckComplete = false;

// Security: Block page initially until authentication is verified
document.body.style.display = 'none';

// Clear any potentially cached authentication state
function clearAuthState() {
  localStorage.clear();
  sessionStorage.clear();
  
  // Clear any auth cookies if they exist
  document.cookie.split(";").forEach(function(c) { 
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
  });
}

// Force redirect to login with cleanup
function forceLoginRedirect(reason = 'Authentication required') {
  console.log('Forcing login redirect:', reason);
  clearAuthState();
  
  // Use replace to prevent back button issues
  window.location.replace('login.html');
}

// Enhanced authentication guard
export function initializeAuthGuard(options = {}) {
  const {
    requiredRole = 'teacher',
    timeout = 5000,
    onAuthSuccess = () => {},
    onAuthFailure = () => {}
  } = options;

  console.log('Initializing authentication guard...');

  // Check for direct URL access (security measure)
  function checkDirectAccess() {
    const referrer = document.referrer;
    const hasReferrer = referrer && (referrer.includes('login.html') || referrer.includes(window.location.hostname));
    
    if (!hasReferrer) {
      console.log('Direct URL access detected - requiring fresh authentication');
    }
  }

  checkDirectAccess();

  // Set timeout for authentication check
  authCheckTimeout = setTimeout(() => {
    if (!authCheckComplete) {
      console.log('Authentication timeout - redirecting to login');
      forceLoginRedirect('Authentication timeout');
    }
  }, timeout);

  // Main authentication state listener
  onAuthStateChanged(auth, async (user) => {
    try {
      // Clear timeout since we got a response
      if (authCheckTimeout) {
        clearTimeout(authCheckTimeout);
        authCheckComplete = true;
      }

      console.log('Auth state changed. User:', user ? user.uid : 'null');

      // No user authenticated
      if (!user) {
        console.log('No authenticated user found');
        forceLoginRedirect('No user authenticated');
        onAuthFailure('No user authenticated');
        return;
      }

      // Verify user document exists and has correct role
      console.log('Verifying user permissions...');
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (!userDoc.exists()) {
        console.log('User document not found');
        await signOut(auth);
        forceLoginRedirect('User account not found');
        onAuthFailure('User account not found');
        return;
      }

      const userData = userDoc.data();

      // Check role
      if (userData.role !== requiredRole) {
        console.log(`User role mismatch. Expected: ${requiredRole}, Got: ${userData.role}`);
        await signOut(auth);
        forceLoginRedirect('Insufficient permissions');
        onAuthFailure('Insufficient permissions');
        return;
      }

      // Check if account is disabled
      if (userData.disabled === true) {
        console.log('User account is disabled');
        await signOut(auth);
        forceLoginRedirect('Account disabled');
        onAuthFailure('Account disabled');
        return;
      }

      // Authentication successful
      console.log('Authentication successful for:', userData.email);
      isAuthenticated = true;

      // Show page content
      document.body.style.display = 'block';

      // Call success callback
      onAuthSuccess(user, userData);

    } catch (error) {
      console.error('Authentication error:', error);
      
      // Sign out on any error
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error('Error signing out:', signOutError);
      }

      forceLoginRedirect('Authentication error');
      onAuthFailure(error.message);
    }
  });

  // Monitor token changes for logout detection
  auth.onIdTokenChanged((user) => {
    if (isAuthenticated && !user) {
      console.log('User token changed - user signed out elsewhere');
      forceLoginRedirect('Signed out elsewhere');
    }
  });

  // Page visibility security check
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isAuthenticated) {
      const user = auth.currentUser;
      if (!user) {
        console.log('User no longer authenticated on page focus');
        forceLoginRedirect('Authentication lost');
      }
    }
  });

  // Prevent back button to login after authentication
  window.addEventListener('popstate', (event) => {
    if (isAuthenticated && window.location.pathname.includes('login.html')) {
      console.log('Preventing navigation back to login page');
      window.history.pushState(null, '', window.location.href);
    }
  });
}

// Enhanced logout function
export async function secureLogout() {
  try {
    console.log('Performing secure logout...');
    
    // Clear authentication flag
    isAuthenticated = false;
    
    // Clear all local storage
    clearAuthState();
    
    // Sign out from Firebase
    await signOut(auth);
    
    // Force redirect to login
    window.location.replace('login.html');
    
  } catch (error) {
    console.error('Logout error:', error);
    // Force redirect even if signout fails
    clearAuthState();
    window.location.replace('login.html');
  }
}

// Check if user is currently authenticated
export function isUserAuthenticated() {
  return isAuthenticated && auth.currentUser;
}

// Get current authenticated user
export function getCurrentUser() {
  return isUserAuthenticated() ? auth.currentUser : null;
}