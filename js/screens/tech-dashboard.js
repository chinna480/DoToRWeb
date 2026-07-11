// ============================================================
// Tech Dashboard — Auto-assignment with Accept / Skip
// ============================================================

const STATUS_FLOW = ['pending', 'accepted', 'assigned', 'completed'];

Router.register('tech', {
  render() {
    const tech = Store.get('techInfo', null);

    // If already logged in, go straight to dashboard
    if (tech && tech.name && tech.phone) {
      return renderDashboard();
    }
    return renderLogin();
  },
  init(params) {
    const tech = Store.get('techInfo', null);
    if (tech && tech.name && tech.phone) {
      return initDashboard();
    }
    return initLogin();
  }
});

// ─── Login Screen ──────────────────────────────────────────
function renderLogin() {
  return {
    html: `
      <div class="screen">
        <div class="scroll-content" style="padding-top:60px;max-width:420px;margin:0 auto">
          <div style="text-align:center;margin-bottom:30px">
            <div style="font-size:56px;margin-bottom:10px">🔧</div>
            <div style="font-size:28px;font-weight:900;background:linear-gradient(135deg,#FF6B00 0%,#ff9933 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">Technician Portal</div>
            <div style="font-size:13px;color:var(--text-secondary);margin-top:6px;font-weight:600">Sign in to start receiving orders</div>
          </div>

          <div class="glass" style="padding:24px">
            <div class="form-group">
              <label class="form-label">👤 Full Name</label>
              <div class="form-field">
                <span class="form-icon">🧑‍🔧</span>
                <input class="form-input" id="techName" placeholder="Enter your name" type="text" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">📱 Phone Number</label>
              <div class="form-field">
                <span class="form-icon">🇮🇳 +91</span>
                <input class="form-input" id="techPhone" placeholder="Enter 10 digit number" type="tel" maxlength="10" />
              </div>
            </div>
            <button class="btn btn-primary btn-block" onclick="window.techLogin()" style="margin-top:8px">🔧 Sign In →</button>
          </div>

          <div style="text-align:center;margin-top:20px">
            <button class="btn btn-outline btn-sm" onclick="Router.navigate('splash')" style="display:inline-flex">← Back to Home</button>
          </div>
        </div>
      </div>
    `
  };
}

function initLogin() {
  window.techLogin = () => {
    const name = document.getElementById('techName').value.trim();
    const phone = document.getElementById('techPhone').value.trim();

    if (!name) { showAlert('Error', 'Enter your full name!'); return; }
    if (phone.length !== 10) { showAlert('Error', 'Enter valid 10 digit phone number!'); return; }

    // Save tech info
    const techInfo = {
      name,
      phone,
      joinedAt: new Date().toISOString(),
      online: true
    };
    Store.set('techInfo', techInfo);
    Store.set('userRole', 'tech');

    // Save/update in Firebase
    firebase.database().ref('techs/' + phone).update(techInfo).catch(() => {});

    Router.navigate('tech');
  };

  return () => { delete window.techLogin; };
}

// ─── Dashboard Screen ──────────────────────────────────────
function renderDashboard() {
  const tech = Store.get('techInfo', {});

  return {
    html: `
      <div class="screen">
        <!-- Header -->
        <div class="tech-header">
          <div class="tech-header-left">
            <div class="tech-avatar-circle">🧑‍🔧</div>
            <div>
              <div class="tech-header-name">${tech.name || 'Technician'}</div>
              <div class="tech-header-phone">📱 +91 ${tech.phone || ''}</div>
            </div>
          </div>
          <div class="tech-header-right">
            <button class="tech-online-toggle ${Store.get('techOnline', true) ? 'online' : 'offline'}" id="techOnlineToggle" onclick="window.toggleTechOnline()">
              <span class="tech-online-dot"></span>
              <span id="techOnlineLabel">${Store.get('techOnline', true) ? 'Online' : 'Offline'}</span>
            </button>
            <button class="tech-logout-btn" onclick="window.techLogout()" title="Sign Out">🚪</button>
          </div>
        </div>

        <!-- Stats Bar -->
        <div class="tech-stats-bar">
          <div class="tech-stat-item">
            <div class="tech-stat-value" id="statPending">0</div>
            <div class="tech-stat-label">Pending</div>
          </div>
          <div class="tech-stat-item">
            <div class="tech-stat-value" id="statActive" style="color:var(--primary)">0</div>
            <div class="tech-stat-label">Active</div>
          </div>
          <div class="tech-stat-item">
            <div class="tech-stat-value" id="statCompleted" style="color:var(--success)">0</div>
            <div class="tech-stat-label">Completed</div>
          </div>
        </div>

        <!-- Tab Filters -->
        <div class="tech-tabs">
          <button class="tech-tab active" data-tab="new" onclick="window.setTechTab('new')">🆕 New Orders</button>
          <button class="tech-tab" data-tab="active" onclick="window.setTechTab('active')">🔧 My Jobs</button>
          <button class="tech-tab" data-tab="completed" onclick="window.setTechTab('completed')">✅ History</button>
        </div>

        <!-- Orders Container -->
        <div id="techOrdersContainer" style="padding:10px 15px 90px">
          <div class="empty-card">
            <div style="font-size:40px;margin-bottom:10px">⏳</div>
            <div class="empty-text">Loading orders...</div>
          </div>
        </div>

        <!-- Order Detail Panel (slide-up) -->
        <div id="techOrderDetail" class="tech-detail-panel" style="display:none">
          <div class="tech-detail-backdrop" onclick="window.closeTechDetail()"></div>
          <div class="tech-detail-content glass-strong">
            <div class="tech-detail-handle"></div>
            <div id="techDetailInner"></div>
          </div>
        </div>
      </div>
    `
  };
}

function initDashboard() {
  const tech = Store.get('techInfo', {});
  const techPhone = tech.phone || '';
  let currentTab = 'new';
  let allOrders = {};
  let ordersListener = null;
  let detailOrderId = null;

  // ─── Listen to all orders ────────────────────────────────
  const ordersRef = firebase.database().ref('orders');

  function processOrders(snap) {
    allOrders = {};
    if (snap.exists()) {
      snap.forEach(child => {
        const order = child.val();
        order._key = child.key;
        allOrders[child.key] = order;
      });
    }
    renderOrders(currentTab);
    updateStats();
  }

  ordersRef.on('value', processOrders);
  ordersListener = () => ordersRef.off('value', processOrders);

  // ─── Render Orders ──────────────────────────────────────
  function renderOrders(tab) {
    const container = document.getElementById('techOrdersContainer');
    if (!container) return;

    const orders = Object.values(allOrders);

    let filtered = [];
    if (tab === 'new') {
      // Pending orders NOT assigned to anyone
      filtered = orders.filter(o => o.status === 'pending');
      // Sort newest first
      filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } else if (tab === 'active') {
      // Orders assigned to this tech that are in progress
      filtered = orders.filter(o =>
        (o.status === 'accepted' || o.status === 'assigned') &&
        o.techPhone === techPhone
      );
    } else if (tab === 'completed') {
      // Completed orders by this tech
      filtered = orders.filter(o =>
        o.status === 'completed' &&
        o.techPhone === techPhone
      );
      filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }

    if (!filtered.length) {
      const emptyMessages = {
        'new': '🎉 No pending orders right now!',
        'active': '📭 No active jobs. Accept a new order!',
        'completed': '📭 No completed jobs yet.'
      };
      container.innerHTML = `
        <div class="empty-card">
          <div style="font-size:48px;margin-bottom:12px">${tab === 'new' ? '🛠️' : tab === 'active' ? '🔧' : '📋'}</div>
          <div class="empty-text">${emptyMessages[tab]}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:6px;font-weight:600">
            ${tab === 'new' ? 'Orders will appear here in real-time' : ''}
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(order => {
      const svcIcon = getServiceIcon(order.service);

      // Check if this order was recently created (within last 5 minutes)
      const isNew = order.createdAt && (Date.now() - new Date(order.createdAt).getTime()) < 5 * 60 * 1000;

      // Distance badge
      let distBadge = '';
      if (order.location) {
        const techLoc = Store.get('techLocation', null);
        if (techLoc && techLoc.lat) {
          // Simple distance calculation
          const [cLat, cLng] = order.location.split(',').map(Number);
          if (cLat && cLng) {
            const dist = getDistanceFromLatLon(techLoc.lat, techLoc.lng, cLat, cLng);
            if (dist !== null) {
              distBadge = `<span class="tech-dist-badge">📍 ${dist < 1 ? (dist * 1000).toFixed(0) + 'm' : dist.toFixed(1) + 'km'}</span>`;
            }
          }
        }
      }

      const timeAgo = order.createdAt ? getTimeAgo(order.createdAt) : '';

      return `
        <div class="tech-order-card ${isNew ? 'new' : ''}" data-key="${order._key}" onclick="window.openTechDetail('${order._key}')">
          ${isNew && tab === 'new' ? '<div class="tech-new-flash">🆕 NEW</div>' : ''}
          ${tab === 'new' ? distBadge : ''}
          <div class="tech-order-top">
            <span class="tech-order-service">${svcIcon} ${order.service || 'Service'}</span>
            <span class="tech-order-time">${timeAgo}</span>
          </div>
          <div class="tech-order-customer">${order.customerName || 'Customer'} ${order.brand ? '• ' + order.brand : ''}${order.model ? ' • ' + order.model : ''}</div>
          <div class="tech-order-issue">${order.issue || order.repair || 'General Service'}</div>
          <div class="tech-order-location">📍 ${order.address || order.location || 'No location'}</div>
          <div class="tech-order-bottom">
            <div class="tech-order-id">#${(order._key || '').slice(-5).toUpperCase()}</div>
            ${tab === 'new' ? `
              <div class="tech-order-actions" onclick="event.stopPropagation()">
                <button class="btn btn-success btn-sm" onclick="window.acceptOrder('${order._key}')">✅ Accept</button>
                <button class="btn btn-outline btn-sm" onclick="window.skipOrder('${order._key}')">⏭️ Skip</button>
              </div>
            ` : tab === 'active' ? `
              <div class="tech-order-status-pill in-progress">🔧 In Progress</div>
            ` : `
              <div class="tech-order-status-pill done">✅ Done</div>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Scroll to top when switching tabs
    if (container.parentElement) {
      container.parentElement.scrollTop = 0;
    }
  }

  // ─── Update Stats ─────────────────────────────────────────
  function updateStats() {
    const orders = Object.values(allOrders);
    const pending = orders.filter(o => o.status === 'pending').length;
    const active = orders.filter(o => (o.status === 'accepted' || o.status === 'assigned') && o.techPhone === techPhone).length;
    const completed = orders.filter(o => o.status === 'completed' && o.techPhone === techPhone).length;

    const pEl = document.getElementById('statPending');
    const aEl = document.getElementById('statActive');
    const cEl = document.getElementById('statCompleted');
    if (pEl) pEl.textContent = pending;
    if (aEl) aEl.textContent = active;
    if (cEl) cEl.textContent = completed;
  }

  // ─── Tab Switching ────────────────────────────────────────
  window.setTechTab = (tab) => {
    currentTab = tab;
    document.querySelectorAll('.tech-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    renderOrders(tab);
  };

  // ─── Accept Order (Auto-assign) ────────────────────────────
  window.acceptOrder = (orderId) => {
    const order = allOrders[orderId];
    if (!order) return;

    // Double-check still pending (race condition guard)
    if (order.status !== 'pending') {
      showAlert('Already Taken', 'Another technician has already accepted this order.');
      renderOrders(currentTab);
      return;
    }

    // Use Firebase transaction for safe auto-assignment
    const orderRef = firebase.database().ref('orders/' + orderId);
    orderRef.transaction((currentData) => {
      if (currentData === null) return currentData;
      if (currentData.status !== 'pending') return; // Abort — someone else took it
      currentData.status = 'accepted';
      currentData.techName = tech.name;
      currentData.techPhone = tech.phone;
      currentData.acceptedAt = new Date().toISOString();
      return currentData;
    }, (error, committed, snap) => {
      if (error) {
        showAlert('Error', 'Failed to accept order. Try again.');
        return;
      }
      if (!committed) {
        showAlert('Already Taken', 'Another technician accepted this order first!');
        renderOrders(currentTab);
        return;
      }
      // Success!
      Store.set('lastOrderId', orderId);
      showAlert('✅ Order Accepted!', `You've been assigned to ${order.service || 'Service'} for ${order.customerName || 'Customer'}.\n\nContact them to confirm the visit.`, [
        { text: 'View Details', onPress: () => window.openTechDetail(orderId) },
        { text: 'OK' }
      ]);
      // Play notification sound
      playNotificationSound();
      renderOrders(currentTab);
    });
  };

  // ─── Skip Order ────────────────────────────────────────────
  window.skipOrder = (orderId) => {
    // Simply hide it from this session — stays pending for other techs
    const skipped = Store.get('skippedOrders', []);
    if (!skipped.includes(orderId)) {
      skipped.push(orderId);
      Store.set('skippedOrders', skipped);
    }
    // Remove from view momentarily with animation
    const card = document.querySelector(`.tech-order-card[data-key="${orderId}"]`);
    if (card) {
      card.style.transition = 'all 0.3s ease';
      card.style.opacity = '0';
      card.style.transform = 'translateX(60px)';
      setTimeout(() => renderOrders(currentTab), 300);
    } else {
      renderOrders(currentTab);
    }
  };

  // ─── Open Order Detail ────────────────────────────────────
  window.openTechDetail = (orderId) => {
    detailOrderId = orderId;
    const order = allOrders[orderId];
    if (!order) return;

    const panel = document.getElementById('techOrderDetail');
    const inner = document.getElementById('techDetailInner');
    if (!panel || !inner) return;

    const svcIcon = getServiceIcon(order.service);

    // Determine schedule info
    let scheduleHtml = '';
    if (order.scheduleMode === 'later' && order.scheduleDateLabel && order.scheduleSlot) {
      scheduleHtml = `
        <div class="tech-detail-row">
          <span class="tech-detail-label">📅 Scheduled</span>
          <span class="tech-detail-value">${order.scheduleDateLabel} • 🕐 ${order.scheduleSlot}</span>
        </div>
      `;
    } else {
      scheduleHtml = `
        <div class="tech-detail-row">
          <span class="tech-detail-label">⚡ Schedule</span>
          <span class="tech-detail-value">Immediate (ASAP)</span>
        </div>
      `;
    }

    // Photos
    let photosHtml = '';
    if (order.photos && order.photos.length) {
      photosHtml = `
        <div class="tech-detail-section">
          <div class="tech-detail-label">📸 Customer Photos</div>
          <div class="tech-detail-photos">
            ${order.photos.map(p => `<img src="${p}" class="tech-detail-photo" onclick="window.open('${p}','_blank')" />`).join('')}
          </div>
        </div>
      `;
    }

    // Status-based actions
    let actionsHtml = '';
    if (order.status === 'accepted' || order.status === 'assigned') {
      actionsHtml = `
        <div class="tech-detail-actions">
          <button class="btn btn-success btn-block btn-sm" onclick="window.markCompleted('${orderId}')">✅ Mark as Completed</button>
          <button class="btn btn-outline btn-block btn-sm" onclick="window.callCustomer('${orderId}')">📞 Call Customer</button>
          <button class="btn btn-outline btn-block btn-sm" onclick="window.chatCustomer('${orderId}')">💬 Chat</button>
        </div>
      `;
    } else if (order.status === 'pending') {
      actionsHtml = `
        <div class="tech-detail-actions">
          <button class="btn btn-success btn-block btn-sm" onclick="window.acceptOrder('${orderId}'); window.closeTechDetail();">✅ Accept Order</button>
          <button class="btn btn-outline btn-block btn-sm" onclick="window.skipOrder('${orderId}'); window.closeTechDetail();">⏭️ Skip</button>
        </div>
      `;
    } else if (order.status === 'completed') {
      actionsHtml = `
        <div class="tech-detail-actions">
          <button class="btn btn-outline btn-block btn-sm" onclick="window.callCustomer('${orderId}')">📞 Call Customer</button>
        </div>
      `;
    }

    const addressParts = [];
    if (order.address) addressParts.push(order.address);
    if (order.apartment) addressParts.push(order.apartment);
    if (order.flat) addressParts.push('Flat ' + order.flat);
    if (order.pincode) addressParts.push(order.pincode);
    const fullAddress = addressParts.join(', ') || order.location || 'Not provided';

    inner.innerHTML = `
      <div class="tech-detail-header">
        <div class="tech-detail-icon">${svcIcon}</div>
        <div>
          <div class="tech-detail-title">${order.service || 'Service'}${order.brand ? ' • ' + order.brand : ''}</div>
          <div class="tech-detail-sub">${order.issue || order.repair || 'General Service'}</div>
        </div>
      </div>

      <div class="tech-detail-body">
        <div class="tech-detail-section">
          <div class="tech-detail-label">👤 Customer</div>
          <div class="tech-detail-value">${order.customerName || 'Unknown'}</div>
          <div class="tech-detail-value" style="font-weight:700;color:var(--primary);font-size:15px;margin-top:4px">📞 +91 ${order.customerPhone || '—'}</div>
        </div>

        <div class="tech-detail-row">
          <span class="tech-detail-label">📍 Address</span>
          <span class="tech-detail-value">${fullAddress}</span>
        </div>

        ${order.location ? `
        <div class="tech-detail-row">
          <span class="tech-detail-label">🗺️ Coordinates</span>
          <span class="tech-detail-value">${order.location}</span>
        </div>
        ` : ''}

        ${scheduleHtml}

        <div class="tech-detail-row">
          <span class="tech-detail-label">📱 Device Model</span>
          <span class="tech-detail-value">${order.model || '—'}</span>
        </div>

        <div class="tech-detail-row">
          <span class="tech-detail-label">🏷️ Brand</span>
          <span class="tech-detail-value">${order.brand || '—'}</span>
        </div>

        <div class="tech-detail-row">
          <span class="tech-detail-label">📝 Issue</span>
          <span class="tech-detail-value">${order.issue || order.repair || 'General Service'}</span>
        </div>

        <div class="tech-detail-row">
          <span class="tech-detail-label">📋 Status</span>
          <span class="tech-detail-value" style="font-weight:800">${getStatusLabel(order.status)}</span>
        </div>

        ${order.pincode ? `
        <div class="tech-detail-row">
          <span class="tech-detail-label">📮 Pincode</span>
          <span class="tech-detail-value">${order.pincode}</span>
        </div>
        ` : ''}

        ${photosHtml}
      </div>

      ${actionsHtml}
    `;

    panel.style.display = 'block';
    // Trigger slide-up animation
    setTimeout(() => {
      const content = panel.querySelector('.tech-detail-content');
      if (content) content.classList.add('open');
    }, 10);
  };

  window.closeTechDetail = () => {
    const panel = document.getElementById('techOrderDetail');
    const content = panel?.querySelector('.tech-detail-content');
    if (content) content.classList.remove('open');
    setTimeout(() => {
      if (panel) panel.style.display = 'none';
    }, 300);
  };

  // ─── Mark as Completed ────────────────────────────────────
  window.markCompleted = (orderId) => {
    showAlert('✅ Complete Order?', 'Mark this order as completed?', [
      {
        text: 'Yes, Complete',
        style: 'destructive',
        onPress: () => {
          firebase.database().ref('orders/' + orderId).update({
            status: 'completed',
            completedAt: new Date().toISOString()
          }).then(() => {
            showAlert('✅ Done!', 'Order marked as completed. Great job! 👏');
            window.closeTechDetail();
          }).catch(() => showAlert('Error', 'Failed to update order'));
        }
      },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  // ─── Call Customer ────────────────────────────────────────
  window.callCustomer = (orderId) => {
    const order = allOrders[orderId];
    if (order && order.customerPhone) {
      window.open('tel:+91' + order.customerPhone);
    } else {
      showAlert('Not Available', 'Customer phone number not available');
    }
  };

  // ─── Chat With Customer ───────────────────────────────────
  window.chatCustomer = (orderId) => {
    const order = allOrders[orderId];
    if (order) {
      Router.navigate('chat', {
        orderId,
        role: 'tech',
        customerName: order.customerName || 'Customer',
        techName: Store.get('techInfo', {}).name || 'Technician'
      });
    }
  };

  // ─── Toggle Online Status ────────────────────────────────
  window.toggleTechOnline = () => {
    const current = Store.get('techOnline', true);
    const newStatus = !current;
    Store.set('techOnline', newStatus);

    // Update Firebase
    firebase.database().ref('techs/' + techPhone + '/online').set(newStatus).catch(() => {});

    // Update UI
    const toggle = document.getElementById('techOnlineToggle');
    const label = document.getElementById('techOnlineLabel');
    if (toggle) {
      toggle.className = 'tech-online-toggle ' + (newStatus ? 'online' : 'offline');
    }
    if (label) label.textContent = newStatus ? 'Online' : 'Offline';
  };

  // ─── Logout ────────────────────────────────────────────────
  window.techLogout = () => {
    showAlert('🚪 Sign Out?', 'Are you sure you want to sign out?', [
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          // Set offline
          firebase.database().ref('techs/' + techPhone + '/online').set(false).catch(() => {});
          Store.remove('techInfo');
          Store.remove('techOnline');
          Store.remove('userRole');
          Store.remove('skippedOrders');
          Router.navigate('tech');
        }
      },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  // ─── GPS for distance calculation ─────────────────────────
  let techGpsWatchId = null;
  if (navigator.geolocation) {
    techGpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        Store.set('techLocation', {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        // Re-render to update distance badges
        if (currentTab === 'new') renderOrders(currentTab);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }

  // ─── Notification sound ──────────────────────────────────
  window.playNotificationSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.value = 0.1;
      osc.start();
      setTimeout(() => {
        osc.frequency.value = 1100;
        setTimeout(() => {
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.stop(ctx.currentTime + 0.3);
        }, 150);
      }, 150);
    } catch (e) { /* Audio not available */ }
  };

  // ─── Cleanup ──────────────────────────────────────────────
  // Add body class to hide bottom nav
  document.body.classList.add('tech-mode');

  return () => {
    document.body.classList.remove('tech-mode');
    if (ordersListener) ordersListener();
    if (techGpsWatchId !== null) navigator.geolocation.clearWatch(techGpsWatchId);
    delete window.setTechTab;
    delete window.acceptOrder;
    delete window.skipOrder;
    delete window.openTechDetail;
    delete window.closeTechDetail;
    delete window.markCompleted;
    delete window.callCustomer;
    delete window.chatCustomer;
    delete window.toggleTechOnline;
    delete window.techLogout;
    delete window.playNotificationSound;
  };
}

// ─── Helper Functions ──────────────────────────────────────

function getServiceIcon(service) {
  if (!service) return '🛠️';
  const s = service.toLowerCase();
  if (s.includes('mobile') || s.includes('phone')) return '📱';
  if (s.includes('laptop') || s.includes('pc') || s.includes('computer')) return '💻';
  if (s.includes('tv') || s.includes('television')) return '📺';
  if (s.includes('ac') || s.includes('air condition')) return '❄️';
  if (s.includes('refrigerator') || s.includes('fridge')) return '🧊';
  if (s.includes('washing')) return '🧺';
  if (s.includes('electric')) return '🔌';
  if (s.includes('plumb')) return '🚰';
  if (s.includes('cctv')) return '📡';
  if (s.includes('wifi') || s.includes('router') || s.includes('wi-fi')) return '🌐';
  if (s.includes('ro') || s.includes('purifier')) return '💧';
  if (s.includes('inverter') || s.includes('ups')) return '🔋';
  return '🛠️';
}

function getStatusLabel(status) {
  const map = {
    'pending': '⏳ Pending',
    'accepted': '🔧 In Progress',
    'assigned': '🛵 Assigned',
    'completed': '✅ Completed',
    'scheduled': '📅 Scheduled'
  };
  return map[status] || '❓ Unknown';
}

function getTimeAgo(createdAt) {
  if (!createdAt) return '';
  const now = Date.now();
  const then = new Date(createdAt).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

function getDistanceFromLatLon(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
