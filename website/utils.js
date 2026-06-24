// DoToR - Shared Utility Module (non-module script, window-scoped)

// ── Toast notification ─────────────────────────────
window.showToast = function(msg, type) {
  var existing = document.querySelector('.toast');
  if (existing) existing.remove();
  var toast = document.createElement('div');
  toast.className = 'toast ' + (type || 'success');
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3500);
};

// ── Format date ──────────────────────────────────────
window.formatDate = function(ts) {
  if (!ts) return '--';
  var d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
};

// ── Format time ──────────────────────────────────────
window.formatTime = function(ts) {
  if (!ts) return '--';
  var d = new Date(ts);
  return d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
};

// ── Get greeting based on hour ──────────────────────
window.getGreeting = function() {
  var hour = new Date().getHours();
  return hour < 12 ? 'Good Morning! 👋' : hour < 17 ? 'Good Afternoon! 👋' : 'Good Evening! 👋';
};

// ── Format phone ─────────────────────────────────────
window.formatPhone = function(phone) {
  if (!phone) return 'Add phone number';
  return '+91 ' + phone;
};

// ── Get initials from name ──────────────────────────
window.getInitials = function(name) {
  if (!name) return '👤';
  return name.split(' ').map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
};

// ── Capitalize first letter ─────────────────────────
window.capitalize = function(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// ── Sanitize string for HTML ─────────────────────────
window.sanitizeHtml = function(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

// ── Get URL parameter ──────────────────────────────
window.getUrlParam = function(name) {
  var params = new URLSearchParams(window.location.search);
  return params.get(name);
};

// ── Format status badge class ──────────────────────
window.statusBadgeClass = function(status) {
  if (status === 'pending') return 'pending';
  if (status === 'accepted') return 'accepted';
  if (status === 'completed') return 'completed';
  if (status === 'rejected') return 'rejected';
  return 'pending';
};

// ── Generate Referral Code ────────────────────────────
window.generateReferralCode = function(phone) {
  if (!phone) return '';
  var clean = phone.replace(/[^0-9]/g, '').slice(-6);
  return 'DTR' + clean;
};

// ── Copy to Clipboard ─────────────────────────────────
window.copyToClipboard = function(text) {
  if (!text) return false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      window.showToast('📋 Copied to clipboard!', 'success');
    }).catch(function() {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
  return true;
};
function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand('copy'); window.showToast('📋 Copied!', 'success'); } catch(e) {}
  document.body.removeChild(ta);
}

// ── Generate Invoice HTML ─────────────────────────────
window.generateInvoiceHtml = function(order) {
  if (!order) return '';
  var date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }) : new Date().toLocaleDateString();
  var time = order.time || new Date().toLocaleTimeString();
  var svcIcon = '';
  if (order.serviceCategory === 'mobile') svcIcon = '📱';
  else if (order.serviceCategory === 'laptop') svcIcon = '💻';
  else if (order.serviceCategory === 'ac') svcIcon = '❄️';
  else if (order.serviceCategory === 'tv') svcIcon = '📺';
  else svcIcon = '🔧';
  return '<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;background:#fff;border-radius:16px;">' +
    '<div style="text-align:center;border-bottom:2px dashed #eee;padding-bottom:16px;margin-bottom:16px;">' +
    '<div style="font-size:40px;margin-bottom:8px;">🔧</div>' +
    '<div style="font-size:20px;font-weight:900;color:#1A3A6B;">DoToR</div>' +
    '<div style="font-size:11px;color:#FF6B00;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Service Invoice</div>' +
    '</div>' +
    '<div style="font-size:12px;color:#888;margin-bottom:16px;">' +
    '<div>Invoice #: DOToR-' + (order.id || Date.now()).toString().slice(-8).toUpperCase() + '</div>' +
    '<div>Date: ' + date + '</div>' +
    '<div>Time: ' + time + '</div>' +
    '</div>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">' +
    '<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 4px;font-size:12px;font-weight:700;color:#888;">Service</td><td style="padding:8px 4px;font-size:12px;font-weight:700;color:#1A3A6B;text-align:right;">' + svcIcon + ' ' + (order.serviceLabel || 'Repair') + '</td></tr>' +
    (order.brand ? '<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 4px;font-size:12px;font-weight:700;color:#888;">Brand</td><td style="padding:8px 4px;font-size:12px;font-weight:700;color:#1A3A6B;text-align:right;">' + order.brand + '</td></tr>' : '') +
    (order.modelName ? '<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 4px;font-size:12px;font-weight:700;color:#888;">Model</td><td style="padding:8px 4px;font-size:12px;font-weight:700;color:#1A3A6B;text-align:right;">' + order.modelName + '</td></tr>' : '') +
    '<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 4px;font-size:12px;font-weight:700;color:#888;">Issue</td><td style="padding:8px 4px;font-size:12px;font-weight:700;color:#1A3A6B;text-align:right;max-width:200px;word-break:break-word;">' + (order.description || '—') + '</td></tr>' +
    '<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 4px;font-size:12px;font-weight:700;color:#888;">Location</td><td style="padding:8px 4px;font-size:12px;font-weight:700;color:#1A3A6B;text-align:right;">' + (order.location || '—') + '</td></tr>' +
    '<tr style="border-bottom:2px solid #1A3A6B;"><td style="padding:8px 4px;font-size:14px;font-weight:800;color:#1A3A6B;">Status</td><td style="padding:8px 4px;font-size:14px;font-weight:800;color:#FF6B00;text-align:right;text-transform:capitalize;">' + (order.status || 'pending') + '</td></tr>' +
    '</table>' +
    '<div style="text-align:center;font-size:11px;color:#aaa;padding-top:12px;border-top:1px solid #eee;">' +
    '<div>Thank you for choosing DoToR!</div>' +
    '<div style="margin-top:4px;">Doorstep Repair Service</div>' +
    '</div></div>';
};

// ── Dark Mode Toggle ────────────────────────────
window.toggleDarkMode = function() {
  var html = document.documentElement;
  var current = html.getAttribute('data-theme') || 'light';
  var next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  try { localStorage.setItem('dotorTheme', next); } catch(e) {}
  var btn = document.getElementById('darkModeToggle');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
};

// ── Init Dark Mode from saved preference ───────
window.initDarkMode = function() {
  var saved = null;
  try { saved = localStorage.getItem('dotorTheme'); } catch(e) {}
  if (!saved) {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      saved = 'dark';
    }
  }
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    var btn = document.getElementById('darkModeToggle');
    if (btn) btn.textContent = '☀️';
  }
};
