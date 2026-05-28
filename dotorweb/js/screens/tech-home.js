// Tech Home Screen - Technician job management
Router.register('tech-home', {
  render() {
    const name = Store.get('techName', 'Technician');
    const loc = Store.get('techLocation', 'Your Location');
    return {
      html: `
        <div class="screen" id="techHomeScreen">
          <!-- HOME TAB CONTENT -->
          <div id="techHomeContent">
            <div class="tech-header">
              <div>
                <div class="tech-greeting">Welcome Back! 👋</div>
                <div class="tech-name-text">${name}</div>
                <div class="tech-loc-text">📍 Serving ${loc}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
                <button class="tech-avatar-btn" onclick="Router.navigate('tech-profile')">
                  <span style="font-size:24px">🔧</span>
                </button>
                <button class="online-pill active" id="onlineBtn" onclick="window.toggleOnline()">
                  🟢 Online
                </button>
              </div>
            </div>
            <div class="earnings-row">
              <div class="earn-card"><div class="earn-label">Today's Jobs</div><div class="earn-value" id="totalJobs">0</div></div>
              <div class="earn-card"><div class="earn-label">Pending</div><div class="earn-value" id="pendingCount">0</div></div>
              <div class="earn-card"><div class="earn-label">Total</div><div class="earn-value" id="totalCompleted">0</div></div>
            </div>
            <div class="section-title">🔧 Ongoing Job</div>
            <div id="ongoingJob">
              <div class="empty-card"><span class="empty-text">No ongoing job right now</span></div>
            </div>
            <div class="section-title">⚡ Quick Actions</div>
            <div class="quick-row">
              <div class="quick-card" onclick="window.switchTechTab('pending')">
                <div class="quick-icon-wrap">📋</div>
                <div class="quick-label">Pending Jobs</div>
                <div class="quick-count" id="quickPendingCount">0</div>
              </div>
              <div class="quick-card" onclick="window.switchTechTab('completed')">
                <div class="quick-icon-wrap">✅</div>
                <div class="quick-label">Completed</div>
                <div class="quick-sub-label" id="quickCompletedLabel">0 today</div>
              </div>
              <div class="quick-card" onclick="window.techWebLogout()">
                <div class="quick-icon-wrap">🚪</div>
                <div class="quick-label">Logout</div>
              </div>
            </div>
            <div style="height:80px"></div>
          </div>

          <!-- PENDING TAB CONTENT -->
          <div id="techPendingContent" style="display:none">
            <div class="header header-orange">
              <div>
                <div class="home-greeting">📋 Pending Jobs</div>
                <div class="home-name" id="techPendingTitle">0 jobs waiting</div>
              </div>
            </div>
            <div id="pendingJobsList">
              <div class="empty-card"><span class="empty-text">No new jobs right now</span></div>
            </div>
            <div style="height:80px"></div>
          </div>

          <!-- COMPLETED TAB CONTENT -->
          <div id="techCompletedContent" style="display:none">
            <div class="header header-orange">
              <div>
                <div class="home-greeting">✅ Completed Jobs</div>
                <div class="home-name" id="techCompletedTitle">0 total</div>
              </div>
            </div>
            <div id="completedJobsList">
              <div class="empty-card"><span class="empty-text">No completed jobs yet</span></div>
            </div>
            <div style="height:80px"></div>
          </div>

          <!-- BOTTOM TAB BAR -->
          <div class="bottom-tab-bar" id="techTabBar">
            <div class="tab-item active" data-tab="home" onclick="window.switchTechTab('home')">
              <span class="tab-icon">🏠</span>
              <span class="tab-label">Home</span>
              <div class="tab-indicator"></div>
            </div>
            <div class="tab-item" data-tab="pending" onclick="window.switchTechTab('pending')">
              <span class="tab-icon">📋</span>
              <span class="tab-label">Pending</span>
              <div class="tab-badge" id="pendingBadge" style="display:none">0</div>
            </div>
            <div class="tab-item" data-tab="completed" onclick="window.switchTechTab('completed')">
              <span class="tab-icon">✅</span>
              <span class="tab-label">Completed</span>
            </div>
            <div class="tab-item" data-tab="profile" onclick="window.switchTechTab('profile')">
              <span class="tab-icon">👤</span>
              <span class="tab-label">Profile</span>
            </div>
          </div>
        </div>
      `,
      init() {
        let isOnline = true;
        let ongoingOrder = null;
        let custLat = null, custLng = null;
        let myLat = 17.3850, myLng = 78.4867;
        let prevPendingIds = new Set();
        let isFirstLoad = true; // skip browser notifications on initial page load
        let map = null, custMarker = null, myMarker = null, polyline = null;
        let techPushToken = Store.get('pushToken', '');
        let dailyCompletedCount = 0;
        let areaAssignments = {};
        let pendingOrdersMap = {};
        const myPhone = Store.get('techPhone', '');
        const SPEED = 0.3; // km/min (~18 km/h — realistic city speed)

        // ── GPS-based matching configuration ─────────────────────────────────────
        // RADIUS_KM:         Maximum distance (km) to show pending jobs to a tech
        // AUTO_ASSIGN_RADIUS: Distance (km) within which a job is auto-assigned
        // If GPS is unavailable, falls back to text-based location/pincode matching
        const RADIUS_KM = 10          // Show jobs within 10km
        const AUTO_ASSIGN_RADIUS = 5  // Auto-assign jobs within 5km
        let autoAssignRunning = false // prevent double auto-assign attempts
        // ─────────────────────────────────────────────────────────────────────────

        // ── Browser Notification Support ────────────────────────────────────────
        // Request permission for desktop browser notifications
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }

        function playNotifSound(type) {
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (type === 'new-job') {
              // Two quick urgent beeps — new job alert!
              const osc1 = ctx.createOscillator(); const g1 = ctx.createGain();
              osc1.connect(g1); g1.connect(ctx.destination);
              osc1.frequency.value = 900;
              g1.gain.setValueAtTime(0.12, ctx.currentTime);
              g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
              osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.12);

              const osc2 = ctx.createOscillator(); const g2 = ctx.createGain();
              osc2.connect(g2); g2.connect(ctx.destination);
              osc2.frequency.value = 1200;
              g2.gain.setValueAtTime(0.12, ctx.currentTime + 0.15);
              g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.27);
              osc2.start(ctx.currentTime + 0.15); osc2.stop(ctx.currentTime + 0.27);
            }
          } catch (e) {}
        }

        function showBrowserNotification(title, body, orderId) {
          if (!('Notification' in window) || Notification.permission !== 'granted') return;
          try {
            const notif = new Notification(title, {
              body,
              icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔧</text></svg>',
              tag: 'new-job-' + orderId,
              requireInteraction: true,
            });
            notif.onclick = () => {
              window.focus();
              if (window.switchTechTab) window.switchTechTab('pending');
              notif.close();
            };
            // Play a distinct "new job" sound effect
            playNotifSound('new-job');
          } catch (e) { /* notification failed silently */ }
        }

        function renderPendingJobs(pending) {
          // Store orders in map so acceptJob can look up order data without HTML escaping issues
          pendingOrdersMap = {};
          pending.forEach(o => { pendingOrdersMap[o.id] = o; });

          const el = document.getElementById('pendingJobsList');
          const title = document.getElementById('techPendingTitle');
          const count = document.getElementById('pendingCount');
          if (!el) return;
          if (pending.length === 0) {
            el.innerHTML = '<div style="padding:50px 20px;text-align:center"><div style="font-size:50px;margin-bottom:15px">🎉</div><div style="font-size:16px;font-weight:800;color:var(--dark)">All caught up!</div><div style="font-size:13px;color:var(--gray);margin-top:5px">No pending jobs right now</div></div>';
            if (title) title.textContent = '0 jobs waiting';
            if (count) count.textContent = '0';
            return;
          }
          if (title) title.textContent = pending.length + ' jobs waiting';
          if (count) count.textContent = pending.length;
          el.innerHTML = pending.map(o => {
            // Show GPS distance if available
            const distDisplay = o.gpsDistance != null
              ? (o.gpsDistance <= AUTO_ASSIGN_RADIUS
                  ? `📍 ${o.gpsDistance.toFixed(1)} km (auto-assign range 🎯)`
                  : `📍 ${o.gpsDistance.toFixed(1)} km away`)
              : null;
            return `
            <div class="job-card pending">
              <div class="job-new-badge">NEW</div>
              <div class="job-customer">👤 ${o.customerName}</div>
              <div class="job-type">📱 ${o.brand} — ${o.repair}</div>
              <div class="job-location">📍 ${o.location}</div>
              ${o.pincode ? `<div class="job-location">📮 ${o.pincode}</div>` : ''}
              <div class="job-time">🕐 ${o.time}</div>
              ${distDisplay ? `<div class="job-location" style="${o.gpsDistance <= AUTO_ASSIGN_RADIUS ? 'color:#2e7d32;font-weight:800' : ''}">${distDisplay}</div>` : ''}
              <div class="job-actions">
                ${ongoingOrder
                  ? '<div style="width:100%;background:#fff3e0;padding:10px;border-radius:10px;text-align:center;font-size:12px;font-weight:700;color:#e65100">⚠️ Complete current job first</div>'
                  : `
                    <button class="btn btn-sm btn-danger" onclick="window.rejectJob('${o.id}')" style="flex:1">✕ Reject</button>
                    <button class="btn btn-sm btn-dark" onclick="window.acceptJob('${o.id}')" style="flex:1">✓ Accept</button>
                  `
                }
              </div>
              ${o.id ? `<button class="btn btn-primary btn-sm btn-block" onclick="window.goToChatFromPending('${o.id}','${o.customerName || 'Customer'}'}" style="margin-top:8px">💬 Chat with Customer</button>` : ''}
            </div>
          `}).join('');
        }

        function renderCompletedJobs(completed) {
          const el = document.getElementById('completedJobsList');
          const title = document.getElementById('techCompletedTitle');
          const quickLabel = document.getElementById('quickCompletedLabel');
          const totalEl = document.getElementById('totalCompleted');
          if (!el) return;
          if (completed.length === 0) {
            el.innerHTML = '<div style="padding:50px 20px;text-align:center"><div style="font-size:50px;margin-bottom:15px">📦</div><div style="font-size:16px;font-weight:800;color:var(--dark)">No completed jobs yet</div><div style="font-size:13px;color:var(--gray);margin-top:5px">Your completed jobs will appear here!</div></div>';
            if (title) title.textContent = '0 total';
            if (quickLabel) quickLabel.textContent = '0 today';
            if (totalEl) totalEl.textContent = '0';
            return;
          }
          if (title) title.textContent = completed.length + ' total · ' + dailyCompletedCount + ' today';
          if (quickLabel) quickLabel.textContent = dailyCompletedCount + ' today';
          if (totalEl) totalEl.textContent = completed.length;
          el.innerHTML = completed.slice(0, 30).map(o => `
            <div class="completed-card">
              <div class="comp-left">
                <div class="comp-customer">👤 ${o.customerName}</div>
                <div class="comp-type">📱 ${o.brand} — ${o.repair}</div>
                <div class="comp-time-small">📍 ${o.location}</div>
                ${o.pincode ? `<div class="comp-time-small">📮 ${o.pincode}</div>` : ''}
              </div>
              <div class="comp-right">
                <div class="comp-done">✅ Done</div>
                <div class="comp-time-small">${o.time || ''}</div>
              </div>
            </div>
          `).join('');
        }

        function renderHomeOngoing(order) {
          const el = document.getElementById('ongoingJob');
          if (!order) {
            el.innerHTML = '<div class="empty-card"><span class="empty-text">No ongoing job right now</span></div>';
            if (map) { map.remove(); map = null; window._currentMap = null; }
            stopGPS();
            return;
          }
          const d = (custLat && myLat) ? parseFloat(calcDistance(myLat, myLng, custLat, custLng)) : null;
          const distance = d !== null ? d + ' km' : '--';
          const eta = d !== null ? '~' + Math.max(1, Math.round(d / SPEED)) + ' mins' : '--';

          el.innerHTML = `
            <div class="ongoing-card">
              <div class="job-customer">👤 ${order.customerName}</div>
              <div class="job-type">📱 ${order.brand} — ${order.repair}</div>
              <div class="job-location">📍 ${order.location}</div>
              ${order.pincode ? `<div class="job-location">📮 ${order.pincode}</div>` : ''}
              <div class="ongoing-progress">⚡ In Progress...</div>
              <div class="dist-banner" style="background:var(--light-gray);margin:10px 0">
                <div>
                  <div class="dist-label" style="color:var(--gray)">Distance to Customer</div>
                  <div class="dist-value" style="color:var(--dark);font-size:20px" id="techDistance">${distance}</div>
                </div>
                <div class="eta-pill"><span class="eta-text" id="techEta">${eta}</span></div>
              </div>
              <div class="loc-row">
                <div class="loc-card">
                  <div class="loc-icon">🛵</div>
                  <div class="loc-label">YOUR LOCATION</div>
                  <div class="loc-name">On the way</div>
                </div>
                <div class="loc-card">
                  <div class="loc-icon">🏠</div>
                  <div class="loc-label">CUSTOMER</div>
                  <div class="loc-name">${custLat ? 'Live' : 'Waiting...'}</div>
                </div>
              </div>
              <div id="techMapContainer" class="tech-map"></div>
              <div class="btn-row">
                <button class="btn btn-primary btn-sm" onclick="window.navigateToCustomer()">🗺️ Navigate</button>
                <button class="btn btn-success btn-sm" onclick="window.callCustomer()">📞 Call</button>
                <button class="btn btn-primary btn-sm" onclick="window.goToTechChat()">💬 Chat</button>
              </div>
              <button class="btn btn-dark btn-block" onclick="window.completeJob('${order.id}')">✅ Mark Complete</button>
            </div>
          `;

          if (custLat || myLat) {
            setTimeout(() => {
              const mc = document.getElementById('techMapContainer');
              if (!mc) return;
              if (map) { map.remove(); }
              map = L.map('techMapContainer').setView([(myLat + (custLat || myLat)) / 2, (myLng + (custLng || myLng)) / 2], 13);
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
              window._currentMap = map;

              myMarker = L.marker([myLat, myLng], {
                icon: L.divIcon({ className: '', html: '<span style="font-size:24px">🛵</span>', iconSize: [30, 30], iconAnchor: [15, 15] })
              }).addTo(map).bindPopup('🛵 You');

              if (custLat) {
                custMarker = L.marker([custLat, custLng]).addTo(map).bindPopup('🏠 Customer');
                polyline = L.polyline([[myLat, myLng], [custLat, custLng]], { color: '#FF6B00', weight: 3, dashArray: '8,8' }).addTo(map);
                const bounds = L.latLngBounds([myLat, myLng], [custLat, custLng]);
                map.fitBounds(bounds, { padding: [50, 50] });
              }
            }, 100);
          }
        }

        window.switchTechTab = (tab) => {
          if (tab === 'profile') {
            Router.navigate('tech-profile');
            return;
          }
          document.querySelectorAll('#techTabBar .tab-item').forEach(t => t.classList.remove('active'));
          const tabEl = document.querySelector(`#techTabBar .tab-item[data-tab="${tab}"]`);
          if (tabEl) tabEl.classList.add('active');

          document.getElementById('techHomeContent').style.display = tab === 'home' ? 'block' : 'none';
          document.getElementById('techPendingContent').style.display = tab === 'pending' ? 'block' : 'none';
          document.getElementById('techCompletedContent').style.display = tab === 'completed' ? 'block' : 'none';
        };

        // Listen for area assignments
        const areaAssignmentsRef = firebase.database().ref('areaAssignments');
        areaAssignmentsRef.on('value', (snap) => {
          if (snap.exists()) {
            areaAssignments = snap.val();
          } else {
            areaAssignments = {};
          }
        });

        // ── GPS-based proximity matching + auto-assign ─────────────────────────────
        //
        // FILTERING LOGIC (two-tier approach):
        //
        // 1. GPS-BASED (preferred):
        //    - When tech's GPS is available, calculate Haversine distance from tech's
        //      location to each order's saved GPS coords (custLat/custLng).
        //    - Only orders within RADIUS_KM (10km) are shown.
        //    - Orders within AUTO_ASSIGN_RADIUS (5km) are auto-assigned.
        //
        // 2. TEXT-BASED (fallback):
        //    - Falls back to area/pincode matching.
        //
        // AUTO-ASSIGN: When a new pending order appears, if within AUTO_ASSIGN_RADIUS,
        // the tech automatically accepts it (first to write wins).
        // ────────────────────────────────────────────────────────────────────────────

        // Get tech's current GPS position for distance calculations
        function initTechGPS() {
          startGPS((lat, lng) => {
            myLat = lat; myLng = lng;
            // Save to techsOnline so the auto-assign system can find nearby techs
            if (myPhone) {
              firebase.database().ref('techsOnline/' + myPhone).set({
                lat, lng,
                name: Store.get('techName', 'Technician'),
                lastSeen: Date.now()
              });
            }
            // Re-filter pending jobs now that we have GPS
            // Force re-trigger orders listener
            const ordersRef2 = firebase.database().ref('orders');
            ordersRef2.once('value', (snap) => { onOrders(snap); });
          }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 });
        }
        initTechGPS();

        // ── Text-based order matching (fallback when GPS is unavailable) ─────────
        function textMatchOrder(order) {
          const techLoc     = Store.get('techLocation', '').toLowerCase().trim();
          const techPincode = Store.get('techPincode', '').toLowerCase().trim();
          if (techLoc) {
            const orderLoc = (order.location || '').toLowerCase().trim();
            if (!orderLoc.includes(techLoc) && !techLoc.includes(orderLoc)) return false;
          }
          if (techPincode) {
            const orderPincode = (order.pincode || '').toLowerCase().trim();
            if (orderPincode && orderPincode !== techPincode) return false;
          }
          return true;
        }

        // ── Auto-accept order (called by auto-assign) ────────────────────────────
        async function autoAcceptOrder(order) {
          try {
            const snap = await firebase.database().ref('orders/' + order.id).once('value');
            if (!snap.exists()) { autoAssignRunning = false; return; }
            const current = snap.val();
            if (current.status !== 'pending' || current.autoAssignedBy) {
              autoAssignRunning = false;
              return; // Another tech already claimed it
            }
            const name = Store.get('techName', 'Technician');
            const loc = Store.get('techLocation', '');
            const phone = Store.get('techPhone', '');
            Store.set('currentOrderId', order.id);
            await firebase.database().ref('orders/' + order.id).update({
              status: 'accepted',
              techPhone: phone,
              techName: name,
              autoAssignedBy: phone,
              autoAssignTime: Date.now()
            });
            firebase.database().ref('techInfo').set({ name, location: loc, phone });
            const area = (order.location || '').toLowerCase().trim();
            if (area) {
              firebase.database().ref('areaAssignments/' + area).set({ name, phone, location: loc });
            }
            showAlert('✅ Auto-Assigned!', `${order.customerName}'s job (${order.brand} ${order.repair}) was auto-assigned to you as the nearest technician!`);
          } catch (e) {
            console.log('Auto-assign failed (another tech may have claimed it):', e.message);
          }
          autoAssignRunning = false;
        }

        // Listen for orders
        const ordersRef = firebase.database().ref('orders');
        const onOrders = (snap) => {
          const allPending = [], completed = [];
          let ongoing = null, count = 0;
          dailyCompletedCount = 0;

          snap.forEach(child => {
            const order = { id: child.key, ...child.val() };
            if (order.status === 'pending')   allPending.push(order);
            if (order.status === 'accepted') {
              // Only mark as ongoing if THIS tech accepted the job
              if (order.techPhone === myPhone) ongoing = order;
            }
            if (order.status === 'completed') { completed.push(order); count++; dailyCompletedCount++; }
          });

          // ── STEP 1: Filter pending jobs by GPS distance (preferred) ───────────
          let pending = allPending;

          if (myLat !== 17.3850 || myLng !== 78.4867) {
            // GPS is available — filter by actual geo-distance
            pending = pending.filter(o => {
              if (o.custLat && o.custLng) {
                const d = parseFloat(calcDistance(myLat, myLng, o.custLat, o.custLng));
                return !isNaN(d) && d <= RADIUS_KM;
              }
              // Fallback: if order has no GPS coords, use text matching
              return textMatchOrder(o);
            });
            // Sort by distance (closest first)
            pending.sort((a, b) => {
              const dA = a.custLat ? parseFloat(calcDistance(myLat, myLng, a.custLat, a.custLng)) : Infinity;
              const dB = b.custLat ? parseFloat(calcDistance(myLat, myLng, b.custLat, b.custLng)) : Infinity;
              return dA - dB;
            });
          } else {
            // ── STEP 2: Fallback — text-based location/pincode matching ─────────
            pending = pending.filter(o => textMatchOrder(o));
          }

          // ── STEP 3: Auto-assign nearest tech for close-by jobs ────────────────
          if (!ongoing && (myLat !== 17.3850 || myLng !== 78.4867)) {
            pending.forEach(order => {
              if (!prevPendingIds.has(order.id) && order.custLat && order.custLng) {
                const d = parseFloat(calcDistance(myLat, myLng, order.custLat, order.custLng));
                if (!isNaN(d) && d <= AUTO_ASSIGN_RADIUS && !autoAssignRunning) {
                  autoAssignRunning = true;
                  const delay = Math.random() * 2000; // 0-2 seconds
                  setTimeout(() => { autoAcceptOrder(order); }, delay);
                }
              }
            });
          }

          // Area assignment: do NOT block pending jobs from being visible to other techs.
          // The area assignment is only used when a tech accepts a job (to track who's serving which area),
          // but all pending jobs should be visible to all techs in that location/pincode.

          // Show browser notifications for NEW pending orders (skip on first load to avoid spamming)
          if (!isFirstLoad) {
            pending.forEach(o => {
              if (!prevPendingIds.has(o.id)) {
                showBrowserNotification(
                  '🔔 New Job Request!',
                  `${o.customerName} needs ${o.brand} ${o.repair} in ${o.location}`,
                  o.id
                );
              }
            });
          }
          isFirstLoad = false;
          prevPendingIds = new Set(pending.map(o => o.id));

          // Attach GPS distance to pending jobs for display
          if (myLat !== 17.3850 || myLng !== 78.4867) {
            pending = pending.map(o => {
              let distKm = null;
              if (o.custLat && o.custLng) {
                const d = parseFloat(calcDistance(myLat, myLng, o.custLat, o.custLng));
                if (!isNaN(d)) distKm = d;
              }
              return { ...o, gpsDistance: distKm };
            });
          }

          document.getElementById('totalJobs').textContent = dailyCompletedCount;
          document.getElementById('pendingCount').textContent = pending.length;
          document.getElementById('totalCompleted').textContent = count;
          document.getElementById('quickPendingCount').textContent = pending.length;
          document.getElementById('quickCompletedLabel').textContent = dailyCompletedCount + ' today';

          // Update pending badge on tab
          const badge = document.getElementById('pendingBadge');
          if (badge) {
            if (pending.length > 0) {
              badge.style.display = 'flex';
              badge.textContent = pending.length > 9 ? '9+' : pending.length;
            } else {
              badge.style.display = 'none';
            }
          }

          renderPendingJobs(pending);
          renderCompletedJobs(completed);

          if (ongoing && (!ongoingOrder || ongoingOrder.id !== ongoing.id)) {
            ongoingOrder = ongoing;
            renderHomeOngoing(ongoing);
            startLocationSharing();
          } else if (!ongoing) {
            ongoingOrder = null;
            renderHomeOngoing(null);
          } else if (ongoing) {
            renderHomeOngoing(ongoing);
          }
        };
        ordersRef.on('value', onOrders);

        // Listen for customer location
        const custLocRef = firebase.database().ref('custLocation');
        const onCustLoc = (snap) => {
          if (!snap.exists()) return;
          custLat = snap.val().lat;
          custLng = snap.val().lng;
          if (ongoingOrder) {
            renderHomeOngoing(ongoingOrder);
            updateDistanceAndEta();
          }
        };
        custLocRef.on('value', onCustLoc);

        function updateDistanceAndEta() {
          if (!custLat || !myLat || !ongoingOrder) return;
          const d = parseFloat(calcDistance(myLat, myLng, custLat, custLng));
          const etaMins = Math.round(d / SPEED);
          const distEl = document.getElementById('techDistance');
          const etaEl = document.getElementById('techEta');
          if (distEl) distEl.textContent = d + ' km';
          if (etaEl) etaEl.textContent = '~' + Math.max(1, etaMins) + ' mins';
          if (myMarker && custMarker) {
            myMarker.setLatLng([myLat, myLng]);
            custMarker.setLatLng([custLat, custLng]);
            if (polyline) polyline.setLatLngs([[myLat, myLng], [custLat, custLng]]);
          }
        }

        function startLocationSharing() {
          startGPS((lat, lng) => {
            myLat = lat; myLng = lng;
            firebase.database().ref('techLocation').set({ lat, lng });
            if (ongoingOrder) updateDistanceAndEta();
          }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 3000 });
        }

        window.acceptJob = (orderId) => {
          const name = Store.get('techName', 'Technician');
          const loc = Store.get('techLocation', '');
          const phone = Store.get('techPhone', '');
          const order = pendingOrdersMap[orderId] || {};
          Store.set('currentOrderId', orderId);
          firebase.database().ref('techInfo').set({ name, location: loc, phone });
          firebase.database().ref('orders/' + orderId).update({ status: 'accepted', techPhone: phone, techName: name })
            .then(() => {
              // Claim this area for this technician so future jobs here come to them
              const area = (order.location || '').toLowerCase().trim();
              if (area) {
                firebase.database().ref('areaAssignments/' + area).set({ name, phone, location: loc });
              }
              showAlert('✅ Job Accepted!', 'Customer can now track you!');
            })
            .catch(() => showAlert('Error', 'Failed to accept. Try again!'));
        };

        window.rejectJob = (orderId) => {
          showAlert('Reject Job?', 'Are you sure?', [
            { text: 'Cancel' },
            { text: 'Reject', style: 'destructive', onPress: () => firebase.database().ref('orders/' + orderId).update({ status: 'rejected' }) }
          ]);
        };

        window.completeJob = (orderId) => {
          showAlert('Mark Complete?', 'Job is done?', [
            { text: 'Cancel' },
            {
              text: 'Complete ✅', onPress: () => {
                firebase.database().ref('orders/' + orderId).update({ status: 'completed' });
                firebase.database().ref('techLocation').remove();
                firebase.database().ref('techInfo').remove();
                firebase.database().ref('custLocation').remove();
                stopGPS();
                showAlert('🎉 Job Complete!', 'Great work! Customer will be asked to review.');
              }
            }
          ]);
        };

        window.navigateToCustomer = () => {
          if (custLat && custLng) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${custLat},${custLng}`, '_blank');
          } else {
            showAlert('Not Available', 'Customer location not available yet!');
          }
        };

        window.callCustomer = () => {
          const custPhone = ongoingOrder?.customerPhone || '';
          if (custPhone) window.open('tel:+91' + custPhone);
          else showAlert('Not Available', 'Customer phone not available!');
        };

        window.goToTechChat = () => {
          if (ongoingOrder) {
            Router.navigate('chat', {
              orderId: ongoingOrder.id,
              role: 'tech',
              customerName: ongoingOrder.customerName || 'Customer',
              techName: Store.get('techName', 'Technician')
            });
          }
        };

        window.goToChatFromPending = (orderId, customerName) => {
          Router.navigate('chat', {
            orderId,
            role: 'tech',
            customerName,
            techName: Store.get('techName', 'Technician')
          });
        };

        window.toggleOnline = () => {
          isOnline = !isOnline;
          const btn = document.getElementById('onlineBtn');
          if (isOnline) {
            btn.className = 'online-pill active';
            btn.textContent = '🟢 Online';
          } else {
            btn.className = 'online-pill inactive';
            btn.textContent = '🔴 Offline';
          }
        };

        window.techWebLogout = () => {
          showAlert('Logout?', 'Are you sure?', [
            { text: 'Cancel' },
            { text: 'Logout', style: 'destructive', onPress: () => { Store.clear(); Router.navigate('role'); } }
          ]);
        };          return () => {
            ordersRef.off('value', onOrders);
            areaAssignmentsRef.off('value');
            custLocRef.off('value', onCustLoc);
            stopGPS();
            // Remove tech from online tracking on cleanup
            if (myPhone) {
              firebase.database().ref('techsOnline/' + myPhone).remove();
            }
            if (map) { map.remove(); window._currentMap = null; }
            delete window.switchTechTab;
            delete window.acceptJob;
            delete window.rejectJob;
            delete window.completeJob;
            delete window.navigateToCustomer;
            delete window.callCustomer;
            delete window.goToTechChat;
            delete window.goToChatFromPending;
            delete window.toggleOnline;
            delete window.techWebLogout;
          };
      }
    };
  }
});
