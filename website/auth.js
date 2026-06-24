// DoToR - Shared Auth Module (non-module script, window-scoped)
// Included on every page that needs auth state.

// ── Auth State ────────────────────────────────────────
window._loginPhone = '';
window._loginStep  = 1;
window._custName   = localStorage.getItem('custName') || '';
window._custPhone  = localStorage.getItem('custPhone') || '';
window._custLocation = localStorage.getItem('custLocation') || 'Your Location';
window._custPincode  = localStorage.getItem('custPincode') || '';

// ── Check if authenticated ──────────────────────────
window.isAuthenticated = function() {
  return !!(localStorage.getItem('custName') && localStorage.getItem('custPhone'));
};

// ── Redirect if not logged in ───────────────────────
window.requireAuth = function() {
  if (!window.isAuthenticated()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
};

// ── Read auth from localStorage (call on page load) ─
window.syncAuth = function() {
  window._custName  = localStorage.getItem('custName') || '';
  window._custPhone = localStorage.getItem('custPhone') || '';
  window._custLocation = localStorage.getItem('custLocation') || 'Your Location';
  window._custPincode  = localStorage.getItem('custPincode') || '';
};

// ── Save auth (call after login) ────────────────────
window.saveAuth = function(name, phone, location, pincode) {
  if (name)  { try { localStorage.setItem('custName', name); } catch(e) {} window._custName = name; }
  if (phone) { try { localStorage.setItem('custPhone', phone); } catch(e) {} window._custPhone = phone; }
  if (location) { try { localStorage.setItem('custLocation', location); } catch(e) {} window._custLocation = location; }
  if (pincode)  { try { localStorage.setItem('custPincode', pincode); } catch(e) {} window._custPincode = pincode; }
};

// ── Logout ───────────────────────────────────────────
window.logoutUser = function() {
  try {
    localStorage.removeItem('custName');
    localStorage.removeItem('custPhone');
    localStorage.removeItem('custLocation');
    localStorage.removeItem('custPincode');
    localStorage.removeItem('lastOrderId');
    localStorage.removeItem('lastCustName');
    localStorage.removeItem('lastCustPhone');
  } catch(e) {}
  window._custName = '';
  window._custPhone = '';
  window.location.href = 'index.html';
};
