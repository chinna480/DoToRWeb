// ============================================================
// DoToR Web - Main App Controller
// ============================================================

// ─── State / Storage ──────────────────────────────────────────
const Store = {
  get(key, def = null) {
    try { const v = localStorage.getItem('dotor_' + key); return v ? JSON.parse(v) : def; }
    catch { return def; }
  },
  set(key, val) { localStorage.setItem('dotor_' + key, JSON.stringify(val)); },
  remove(key) { localStorage.removeItem('dotor_' + key); },
  clear() {
    Object.keys(localStorage).filter(k => k.startsWith('dotor_')).forEach(k => localStorage.removeItem(k));
  }
};

// ─── Reverse Geocode for Display ─────────────────────────────
// Converts lat/lng to a short area/city name using Nominatim (cache-friendly)
function reverseGeocodeForDisplay(lat, lng) {
  // Check if coordinates changed significantly (>~150m) from cached
  const cached = Store.get('_geoCache', {});
  if (cached.lat && cached.name) {
    const dLat = Math.abs(cached.lat - lat);
    const dLng = Math.abs(cached.lng - lng);
    // ~0.001 deg ≈ 100m — if close enough, reuse cached name
    if (dLat < 0.002 && dLng < 0.002) {
      Store.set('custAreaName', cached.name);
      return Promise.resolve(cached.name);
    }
  }

  return fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16`)
    .then(r => r.json())
    .then(data => {
      if (data && data.display_name) {
        // Extract a short area/city name: take first 2-3 meaningful parts
        const parts = data.display_name.split(',').map(s => s.trim()).filter(Boolean);
        // Skip the first part (often the full address / house number) if it looks like a number
        let startIdx = 0;
        if (parts.length > 3 && /^\d+/.test(parts[0])) startIdx = 1;
        // Take up to 3 parts for a nice short name: e.g. "Madhapur, Hyderabad, Telangana"
        const shortName = parts.slice(startIdx, startIdx + 3).join(', ');
        
        Store.set('custAreaName', shortName);
        Store.set('_geoCache', { lat, lng, name: shortName });
        return shortName;
      }
      return '';
    })
    .catch(() => {
      // On error, fall back to a formatted coordinate string (but shorter)
      const fallback = `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
      return fallback;
    });
}

// ─── Custom Alert ─────────────────────────────────────────────
function showAlert(title, message, buttons) {
  const overlay = document.createElement('div');
  overlay.className = 'alert-overlay';
  let btnsHtml = '';
  if (buttons && buttons.length) {
    if (buttons.length === 1) {
      btnsHtml = buttons.map(b =>
        `<button class="alert-btn${b.style === 'destructive' ? ' alert-btn-danger' : ''}" data-idx="0">${b.text}</button>`
      ).join('');
    } else {
      btnsHtml = `<div class="alert-btn-row">` + buttons.map((b, i) =>
        `<button class="${b.style === 'destructive' ? 'alert-btn-danger' : b.style === 'cancel' ? 'alert-btn-cancel' : 'alert-btn-confirm'}" data-idx="${i}">${b.text}</button>`
      ).join('') + `</div>`;
    }
  } else {
    btnsHtml = '<button class="alert-btn" data-idx="0">OK</button>';
  }
  overlay.innerHTML = `
    <div class="alert-box">
      ${title ? `<div class="alert-title">${title}</div>` : ''}
      <div class="alert-message">${message}</div>
      ${btnsHtml}
    </div>
  `;
  overlay.querySelectorAll('button[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      overlay.remove();
      if (buttons && buttons[idx] && buttons[idx].onPress) buttons[idx].onPress();
    });
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ─── SPA Router ───────────────────────────────────────────────
const Router = {
  currentScreen: null,
  currentCleanup: null,
  screenModules: {},

  register(name, module) { this.screenModules[name] = module; },

  async navigate(screen, params = {}) {
    // Cleanup previous screen
    if (this.currentCleanup) {
      try { this.currentCleanup(); } catch (e) { console.warn('Cleanup error:', e); }
      this.currentCleanup = null;
    }

    // Unmount map instances
    if (window._currentMap) {
      window._currentMap.remove();
      window._currentMap = null;
    }

    const app = document.getElementById('app');
    const module = this.screenModules[screen];
    if (!module) {
      app.innerHTML = `<div class="loading-screen"><div class="loading-spinner"></div></div>`;
      return;
    }

    this.currentScreen = screen;
    window.location.hash = screen + (params.orderId ? '?orderId=' + params.orderId : '');

    app.innerHTML = `<div class="loading-screen"><div class="loading-spinner"></div></div>`;

    // Small delay for loading state to show
    await new Promise(r => setTimeout(r, 50));

    const result = module.render(params);
    app.innerHTML = result.html;

    // Mark active screen
    app.querySelector('.screen')?.classList.add('active');

    if (result.init) {
      try { this.currentCleanup = result.init(params); } catch (e) { console.warn('Init error:', e); }
    }

    // Show/hide bottom nav based on screen
    NavBar.show(screen);
  }
};

// ─── Global Helper Functions ──────────────────────────────────
function $(id) { return document.getElementById(id); }

function qs(sel, ctx) { return (ctx || document).querySelector(sel); }

function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

function htmlToElements(html) {
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return div.firstChild;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning! 🌅';
  if (h < 17) return 'Good Afternoon! ☀️';
  return 'Good Evening! 🌙';
}

// ─── GeoLocation ──────────────────────────────────────────────
let gpsWatchId = null;
let currentPosition = { lat: 17.3850, lng: 78.4867 };

function startGPS(onPosition, options = {}) {
  if (!navigator.geolocation) { console.warn('Geolocation not available'); return; }
  if (gpsWatchId !== null) stopGPS();
  gpsWatchId = navigator.geolocation.watchPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      currentPosition = { lat, lng };
      if (onPosition) onPosition(lat, lng);
    },
    err => console.warn('GPS error:', err.message),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000, ...options }
  );
}

function stopGPS() {
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
}

function getCurrentPositionOnce() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(currentPosition); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        currentPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        resolve(currentPosition);
      },
      () => resolve(currentPosition),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}

// ─── Navigation Bar ───────────────────────────────────────────
const NavBar = {
  _customerTabs: [
    { id: 'home', label: 'Home', icon: '🏠', screen: 'home' },
    { id: 'orders', label: 'Orders', icon: '📋', screen: 'orders' },
    { id: 'download', label: 'App', icon: '📲', screen: null, action: 'download' },
  ],
  visible: false,

  get tabs() { return this._customerTabs; },

  show(screen) {
    const nav = document.getElementById('bottomNav');
    const app = document.getElementById('app');
    if (!nav) return;

    // Screens where nav should be hidden
    const hiddenScreens = ['splash', 'customer-login'];
    if (hiddenScreens.includes(screen)) {
      nav.style.display = 'none';
      if (app) app.style.paddingBottom = '0';
      this.visible = false;
      return;
    }

    this.render(screen);
    nav.style.display = 'block';
    if (app) app.style.paddingBottom = '';
    this.visible = true;
  },

  render(activeScreen) {
    const container = document.getElementById('navItems');
    if (!container) return;

    container.innerHTML = this.tabs.map(tab => {
      const isActive = tab.screen === activeScreen;
      return `<button class="nav-item ${isActive ? 'active' : ''}" data-tab="${tab.id}" onclick="NavBar.onTabClick('${tab.id}')">
        <span class="nav-icon">${tab.icon}</span>
        <span class="nav-label">${tab.label}</span>
      </button>`;
    }).join('');
  },

  onTabClick(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    if (tab.action === 'download') {
      window.downloadApp();
    } else if (tab.screen) {
      Router.navigate(tab.screen).catch(function(e) {
        console.warn('Nav navigate error:', e);
      });
    }
  }
};

// ─── Download App Banner ─────────────────────────────────────
window.downloadApp = () => {
  // Direct download of the APK hosted on this site
  window.open('downloads/DoToR-App-v1.0.0.apk', '_blank');
};

window.dismissDownloadBanner = () => {
  const banner = document.getElementById('downloadBanner');
  if (banner) {
    banner.classList.add('hidden');
  }
  Store.set('dismissedDownloadBanner', true);
};

// ─── Hash-based Routing ───────────────────────────────────────
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '');
  if (hash && Router.screenModules[hash.split('?')[0]]) {
    const screen = hash.split('?')[0];
    const params = {};
    const qs = hash.split('?')[1];
    if (qs) {
      qs.split('&').forEach(p => { const [k, v] = p.split('='); params[k] = decodeURIComponent(v); });
    }
    if (Router.currentScreen !== screen) {
      Router.navigate(screen, params).catch(function(e) {
        console.warn('Hashchange navigate error:', e);
      });
    }
  }
});
