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

    // Inject download app badge at top-left of every screen
    injectDownloadBadge(app);

    if (result.init) {
      try { this.currentCleanup = result.init(params); } catch (e) { console.warn('Init error:', e); }
    }
  }
};

// ─── Download App Badge ─────────────────────────────────────
function injectDownloadBadge(appEl) {
  // Remove any existing badge first
  const oldBadge = document.getElementById('downloadBadge');
  if (oldBadge) oldBadge.remove();

  const badge = document.createElement('a');
  badge.id = 'downloadBadge';
  badge.className = 'download-badge';
  badge.href = '#';
  badge.onclick = function(e) {
    e.preventDefault();
    showAlert(
      '📱 Download DoToR App',
      'Get the full experience with our mobile app!<br><br>📲 Available on:<br>• Android (APK)<br>• iOS (Coming Soon)<br><br>Scan the QR code or download directly from our website.',
      [
        { text: 'Download APK 🔽', onPress: () => { window.open('/dotor.apk', '_blank'); } },
        { text: 'Close' }
      ]
    );
  };
  badge.innerHTML = '<span class="download-badge-icon">📱</span><span class="download-badge-text">Get App</span>';
  appEl.appendChild(badge);
}

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
    if (Router.currentScreen !== screen) Router.navigate(screen, params);
  }
});
