// Home Screen - Customer booking
const TIME_SLOTS = [
  '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00',
  '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00',
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PHONE_BRANDS = ['iPhone', 'Samsung', 'OnePlus', 'Redmi', 'Vivo', 'Oppo', 'Realme', 'Nokia'];
const LAPTOP_BRANDS = ['Dell', 'HP', 'Lenovo', 'MacBook', 'Asus', 'Acer', 'MSI', 'Sony'];
const WHY_DOTOR = [
  { icon: '🏠', title: 'Doorstep Service', desc: 'Technician comes to your home!' },
  { icon: '👀', title: 'Repair in Front of You', desc: '100% transparent process!' },
  { icon: '⚡', title: 'Fast Service', desc: 'Arrives within 60 mins!' },
  { icon: '💰', title: 'Best Price', desc: 'No hidden charges ever!' },
];

Router.register('home', {
  render() {
    const name = Store.get('custName', 'Customer');
    const loc = Store.get('custLocation', 'Your Location');
    const whyHtml = WHY_DOTOR.map(w => `
      <div class="why-item">
        <span class="why-icon">${w.icon}</span>
        <div>
          <div class="why-title">${w.title}</div>
          <div class="why-desc">${w.desc}</div>
        </div>
      </div>
    `).join('');

    return {
      html: `
        <div class="screen" id="custHomeScreen">
          <!-- HOME TAB CONTENT -->
          <div id="custHomeContent">
            <div class="header">
              <div>
                <div class="home-greeting">Good Morning! 👋</div>
                <div class="home-name">${name}</div>
                <div class="home-loc">📍 ${loc}</div>
              </div>
              <div class="home-avatar" onclick="Router.navigate('customer-profile')">
                <span style="font-size:24px">👤</span>
              </div>
            </div>
            <div class="section-title">Step 1 — Select Device</div>
            <div class="device-grid">
              <div class="device-card" data-device="phone" onclick="window.selectDevice('phone')">
                <span class="device-icon">📱</span>
                <div class="device-name">Phone</div>
              </div>
              <div class="device-card" data-device="laptop" onclick="window.selectDevice('laptop')">
                <span class="device-icon">💻</span>
                <div class="device-name">Laptop</div>
              </div>
            </div>
            <div id="brandSection" style="display:none">
              <div class="section-title">Step 2 — Select Brand</div>
              <div class="brand-grid" id="brandGrid"></div>
            </div>
            <div id="actionSection" style="display:none">
              <div class="section-title">Step 3 — Describe the Issue</div>
              <div class="desc-box">
                <div class="desc-label">📝 What's the problem? (so technician knows what to bring)</div>
                <textarea
                  id="descriptionInput"
                  class="form-textarea"
                  rows="3"
                  placeholder="e.g. Screen cracked, phone not charging, battery draining fast..."
                ></textarea>
              </div>
              <!-- ── Inline Appointment Toggle ── -->
              <div class="appt-toggle" id="apptToggle" onclick="window.toggleAppointment()">
                <span class="appt-toggle-icon">📅</span>
                <div class="appt-toggle-content">
                  <div class="appt-toggle-title">Want to book an appointment?</div>
                  <div class="appt-toggle-sub">Pick a convenient date & time</div>
                </div>
                <span class="appt-toggle-arrow" id="apptToggleArrow">▶</span>
              </div>

              <!-- ── Appointment Date/Time Picker ── -->
              <div id="apptDateTimeSection" style="display:none">
                <div class="section-title">Select Date</div>
                <div class="date-row" id="apptDateRow"></div>
                <div class="section-title">Select Time Slot</div>
                <div class="slots-grid" id="apptSlotsGrid">
                  ${TIME_SLOTS.map(s => `<button class="slot-btn" data-slot="${s}" onclick="window.selectApptSlot('${s}')">🕐 ${s}</button>`).join('')}
                </div>
              </div>

              <!-- ── Your Address ── -->
              <div class="section-title">📍 Your Address</div>
              <div class="address-box">
                <div class="form-field" style="position:relative">
                  <span class="form-icon">📍</span>
                  <input class="form-input" id="homeAddress" placeholder="Search your area..." type="text" autocomplete="off" />
                </div>
                <div class="form-field" style="margin-top:10px">
                  <span class="form-icon">📮</span>
                  <input class="form-input" id="homePincode" placeholder="Enter 6-digit pincode" type="tel" maxlength="6" />
                </div>
              </div>

              <div class="desc-box">
                <button id="submitRepairBtn" class="submit-repair-btn" onclick="window.submitRepair()">
                  <span id="submitBtnText">📋 Submit Repair Request</span>
                </button>
              </div>
            </div>
            <div class="section-title">⭐ Why DoToR?</div>
            ${whyHtml}
            <div style="height:80px"></div>
          </div>

          <!-- ORDERS TAB CONTENT -->
          <div id="custOrdersContent" style="display:none">
            <div class="header header-orange">
              <div>
                <div class="home-greeting">📋</div>
                <div class="home-name">My Orders</div>
                <div class="home-loc" id="custOrdersCount">0 orders total</div>
              </div>
            </div>
            <!-- Order sub-tabs: All / Active / Completed -->
            <div class="order-sub-tabs">
              <div class="order-sub-tab active" data-filter="all" onclick="window.switchCustOrderFilter('all')">All</div>
              <div class="order-sub-tab" data-filter="active" onclick="window.switchCustOrderFilter('active')">Active</div>
              <div class="order-sub-tab" data-filter="completed" onclick="window.switchCustOrderFilter('completed')">Completed</div>
            </div>
            <div id="custOrdersList">
              <div style="padding:50px 20px;text-align:center">
                <div style="font-size:50px;margin-bottom:15px">📦</div>
                <div style="font-size:16px;font-weight:800;color:var(--dark)">No orders yet</div>
                <div style="font-size:13px;color:var(--gray);margin-top:5px">Book your first repair and it will appear here!</div>
              </div>
            </div>
            <div style="height:80px"></div>
          </div>

          <!-- PROFILE TAB → Navigate to profile screen -->

          <!-- BOTTOM TAB BAR -->
          <div class="bottom-tab-bar">
            <div class="tab-item active" data-tab="home" onclick="window.switchCustTab('home')">
              <span class="tab-icon">🏠</span>
              <span class="tab-label">Home</span>
              <div class="tab-indicator"></div>
            </div>
            <div class="tab-item" data-tab="orders" onclick="window.switchCustTab('orders')">
              <span class="tab-icon">📋</span>
              <span class="tab-label">Orders</span>
            </div>
            <div class="tab-item" data-tab="profile" onclick="window.switchCustTab('profile')">
              <span class="tab-icon">👤</span>
              <span class="tab-label">Profile</span>
            </div>
          </div>
        </div>
      `,
      init() {
        let selectedDevice = null;
        let selectedBrand = null;
        // ── Appointment state ──
        let wantAppointment = false;
        let selectedDate = null;
        let selectedSlot = null;
        let ordersUnsub = null;
        let prevOrderStatuses = {}; // track order status changes for notifications
        let hasAcceptedOrder = false; // whether customer has an accepted order
        let notifTechNearby = false; // prevent duplicate 'technician nearby' notifications
        let techLocUnsub = null;
        let custLocUnsub = null;
        let custLat = null, custLng = null;
        let cachedOrders = []; // cached orders from live listener for filter switching
        let ordersFilter = 'all'; // 'all', 'active', 'completed' — sub-tab filter

        // ── Request browser notification permission ──────────────────────────────
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }

        function playNotifSound(type) {
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (type === 'tech-assigned') {
              // Two ascending beeps — someone is coming!
              const osc1 = ctx.createOscillator(); const g1 = ctx.createGain();
              osc1.connect(g1); g1.connect(ctx.destination);
              osc1.frequency.value = 660;
              g1.gain.setValueAtTime(0.12, ctx.currentTime);
              g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
              osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.15);

              const osc2 = ctx.createOscillator(); const g2 = ctx.createGain();
              osc2.connect(g2); g2.connect(ctx.destination);
              osc2.frequency.value = 880;
              g2.gain.setValueAtTime(0.12, ctx.currentTime + 0.2);
              g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
              osc2.start(ctx.currentTime + 0.2); osc2.stop(ctx.currentTime + 0.35);
            } else if (type === 'tech-nearby') {
              // Three rapid beeps — alert!
              for (let i = 0; i < 3; i++) {
                const osc = ctx.createOscillator(); const g = ctx.createGain();
                osc.connect(g); g.connect(ctx.destination);
                osc.frequency.value = 520;
                const t = ctx.currentTime + i * 0.18;
                g.gain.setValueAtTime(0.12, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                osc.start(t); osc.stop(t + 0.1);
              }
            } else if (type === 'job-complete') {
              // Two descending beeps — satisfying done sound
              const osc1 = ctx.createOscillator(); const g1 = ctx.createGain();
              osc1.connect(g1); g1.connect(ctx.destination);
              osc1.frequency.value = 880;
              g1.gain.setValueAtTime(0.12, ctx.currentTime);
              g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
              osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.2);

              const osc2 = ctx.createOscillator(); const g2 = ctx.createGain();
              osc2.connect(g2); g2.connect(ctx.destination);
              osc2.frequency.value = 660;
              g2.gain.setValueAtTime(0.12, ctx.currentTime + 0.25);
              g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
              osc2.start(ctx.currentTime + 0.25); osc2.stop(ctx.currentTime + 0.45);
            }
          } catch (e) {}
        }

        function showCustBrowserNotification(title, body, orderId, soundType) {
          if (!('Notification' in window) || Notification.permission !== 'granted') return;
          try {
            const notif = new Notification(title, {
              body,
              icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔧</text></svg>',
              tag: 'cust-order-' + orderId,
              requireInteraction: true,
            });
            notif.onclick = () => {
              window.focus();
              Router.navigate('tracking');
              notif.close();
            };
            playNotifSound(soundType || 'default');
          } catch (e) {}
        }

        // ── Listen for customer location in Firebase ──────────────────────────
        const custLocRef = firebase.database().ref('custLocation');
        const onCustLoc = (snap) => {
          if (snap.exists()) {
            custLat = snap.val().lat;
            custLng = snap.val().lng;
          }
        };
        custLocRef.on('value', onCustLoc);

        // ── Store customer GPS in window for ETA calculations ────────────────
        window._custEtaData = null;
        custLocUnsub = () => custLocRef.off('value', onCustLoc);

        // ── Listen for technician location (proximity detection + ETA display) ─
        const techLocRef = firebase.database().ref('techLocation');
        const onTechLoc = (snap) => {
          if (!snap.exists() || !hasAcceptedOrder || !custLat || !custLng) return;
          const { lat, lng } = snap.val();
          if (!lat || !lng) return;
          const d = parseFloat(calcDistance(custLat, custLng, lat, lng));
          const SPEED = 0.3; // km/min
          const etaMins = Math.round(d / SPEED);

          // Update ETA data for customer display
          window._custEtaData = {
            dist: d.toFixed(1) + ' km',
            eta: '~' + Math.max(1, etaMins) + ' mins'
          };
          // Re-render orders to show live ETA
          if (cachedOrders.length > 0) renderCustomerOrders(cachedOrders);

          // Proximity notification (within 1km)
          if (!isNaN(d) && d <= 1.0 && !notifTechNearby) {
            notifTechNearby = true;
            showCustBrowserNotification(
              '🚗 Technician Nearby!',
              'Your technician is less than 1 km away — almost at your door!',
              'proximity',
              'tech-nearby'
            );
          }
        };
        techLocRef.on('value', onTechLoc);
        techLocUnsub = () => techLocRef.off('value', onTechLoc);

        // Load orders for this customer
        const myPhone = Store.get('custPhone', '');
        if (myPhone) {
          const ordersRef = firebase.database().ref('orders');
          const onOrders = (snap) => {
            if (!snap.exists()) {
              document.getElementById('custOrdersCount').textContent = '0 orders total';
              document.getElementById('custOrdersList').innerHTML = `
                <div style="padding:50px 20px;text-align:center">
                  <div style="font-size:50px;margin-bottom:15px">📦</div>
                  <div style="font-size:16px;font-weight:800;color:var(--dark)">No orders yet</div>
                  <div style="font-size:13px;color:var(--gray);margin-top:5px">Book your first repair and it will appear here!</div>
                </div>
              `;
              return;
            }
            const orders = [];
            const currentStatuses = {};
            snap.forEach(child => {
              const o = { id: child.key, ...child.val() };
              currentStatuses[o.id] = o.status;
              // Track whether customer has an accepted (ongoing) order
              if (o.customerPhone === myPhone && o.status === 'accepted') {
                hasAcceptedOrder = true;
              } else if (o.customerPhone === myPhone && o.status === 'completed') {
                hasAcceptedOrder = false;
              }

              // Detect status changes for notifications
              const prevStatus = prevOrderStatuses[o.id];
              if (o.customerPhone === myPhone && o.techName && prevStatus === 'pending' && o.status === 'accepted') {
                showCustBrowserNotification(
                  '🛵 Technician Assigned!',
                  `${o.techName} is on the way to fix your ${o.brand} ${o.repair}!`,
                  o.id,
                  'tech-assigned'
                );
              }
              // Detect status change: any → completed (job done)
              if (o.customerPhone === myPhone && prevStatus && prevStatus !== 'completed' && o.status === 'completed') {
                showCustBrowserNotification(
                  '✅ Repair Completed!',
                  `Your ${o.brand} ${o.repair} is done! Please rate your experience.`,
                  o.id,
                  'job-complete'
                );
              }
              if (o.customerPhone === myPhone) {
                // Add GPS distance/ETA if order is accepted and techLocation exists
                if (o.status === 'accepted') {
                  // We'll update ETA live via techLocation listener below
                }
                orders.push(o);
              }
            });
            prevOrderStatuses = currentStatuses;
            orders.reverse();
            cachedOrders = orders;
            renderCustomerOrders(orders);
          };
          ordersRef.on('value', onOrders);
          ordersUnsub = () => ordersRef.off('value', onOrders);
        }

        function renderCustomerOrders(orders) {
          // Apply filter
          let filtered = orders;
          if (ordersFilter === 'active') {
            filtered = orders.filter(o => o.status === 'pending' || o.status === 'accepted');
          } else if (ordersFilter === 'completed') {
            filtered = orders.filter(o => o.status === 'completed');
          }
          // Update sub-tab counts
          const total = orders.length;
          const activeCount = orders.filter(o => o.status === 'pending' || o.status === 'accepted').length;
          const completedCount = orders.filter(o => o.status === 'completed').length;
          document.querySelectorAll('.order-sub-tab').forEach(el => {
            const filter = el.dataset.filter;
            let label = filter.charAt(0).toUpperCase() + filter.slice(1);
            if (filter === 'all') label = 'All (' + total + ')';
            else if (filter === 'active') label = 'Active (' + activeCount + ')';
            else if (filter === 'completed') label = 'Completed (' + completedCount + ')';
            el.textContent = label;
          });
          document.getElementById('custOrdersCount').textContent = total + ' orders total';
          if (filtered.length === 0) {
            document.getElementById('custOrdersList').innerHTML = `
              <div style="padding:50px 20px;text-align:center">
                <div style="font-size:50px;margin-bottom:15px">📦</div>
                <div style="font-size:16px;font-weight:800;color:var(--dark)">No ${ordersFilter === 'all' ? '' : ordersFilter} orders yet</div>
                <div style="font-size:13px;color:var(--gray);margin-top:5px">Book your first repair and it will appear here!</div>
              </div>
            `;
          } else {
            document.getElementById('custOrdersList').innerHTML = filtered.map(o => {
              const statusColor = o.status === 'completed' ? '#2e7d32' : o.status === 'accepted' ? 'var(--primary)' : 'var(--gray)';
              const statusIcon = o.status === 'completed' ? '✅' : o.status === 'accepted' ? '🔧' : '⏳';
              // Calculate GPS-based ETA for accepted orders
          let custEtaHtml = ''
          if (o.status === 'accepted' && o.techName) {
            custEtaHtml = `<div class="order-tech-name">🛵 ${o.techName} is coming!</div>`
            if (window._custEtaData && window._custEtaData.dist) {
              custEtaHtml += `<div class="cust-eta-row"><span class="cust-eta-text">📍 ${window._custEtaData.dist} away</span><span class="cust-eta-badge">${window._custEtaData.eta}</span></div>`
            }
          }

          return `
                <div class="order-card">
                  <div class="order-left">
                    <div class="order-device">📱 ${o.brand}</div>
                    <div class="order-repair">🔧 ${o.repair}</div>
                    <div class="order-location">📍 ${o.location}</div>
                    ${o.pincode ? `<div class="order-location">📮 ${o.pincode}</div>` : ''}
                    <div class="order-time">🕐 ${o.time}</div>
                    ${custEtaHtml}
                  </div>
                  <div class="order-right">
                    <div style="font-size:20px;text-align:center">${statusIcon}</div>
                    <div style="font-size:11px;font-weight:800;color:${statusColor};text-transform:capitalize">${o.status}</div>
                    ${o.id ? `<button class="order-chat-btn" onclick="Router.navigate('chat',{orderId:'${o.id}',role:'cust',customerName:'${o.customerName || 'Customer'}',techName:'${o.techName || ''}'})">💬 Chat</button>` : ''}
                  </div>
                </div>
              `;
            }).join('');
          }
        }

        window.switchCustOrderFilter = (filter) => {
          ordersFilter = filter;
          document.querySelectorAll('.order-sub-tab').forEach(el => {
            el.classList.toggle('active', el.dataset.filter === filter);
          });
          if (cachedOrders.length > 0) {
            renderCustomerOrders(cachedOrders);
          }
        };

        window.switchCustTab = (tab) => {
          if (tab === 'profile') {
            Router.navigate('customer-profile');
            return;
          }
          // Update tabs
          document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
          document.querySelector(`.tab-item[data-tab="${tab}"]`).classList.add('active');
          // Show/hide content
          document.getElementById('custHomeContent').style.display = tab === 'home' ? 'block' : 'none';
          document.getElementById('custOrdersContent').style.display = tab === 'orders' ? 'block' : 'none';
        };

        window.selectDevice = (type) => {
          selectedDevice = type;
          selectedBrand = null;
          document.querySelectorAll('.device-card').forEach(c => c.classList.remove('active'));
          document.querySelector(`.device-card[data-device="${type}"]`).classList.add('active');
          const brands = type === 'phone' ? PHONE_BRANDS : LAPTOP_BRANDS;
          const brandGrid = document.getElementById('brandGrid');
          brandGrid.innerHTML = brands.map(b => `
            <div class="brand-card" data-brand="${b}" onclick="window.selectBrand('${b}')">
              <span class="device-icon">${type === 'phone' ? '📱' : '💻'}</span>
              <div class="device-name">${b}</div>
            </div>
          `).join('');
          document.getElementById('brandSection').style.display = 'block';
          document.getElementById('actionSection').style.display = 'none';
        };

        window.selectBrand = (brand) => {
          selectedBrand = brand;
          document.querySelectorAll('.brand-card').forEach(c => c.classList.remove('active'));
          document.querySelector(`.brand-card[data-brand="${brand}"]`).classList.add('active');

          // Clear description input when switching brands
          const descInput = document.getElementById('descriptionInput');
          if (descInput) descInput.value = '';

          document.getElementById('actionSection').style.display = 'block';
        };

        // ── Initialize Address/Pincode from Store ──
        const addrInput = document.getElementById('homeAddress');
        const pincodeInput = document.getElementById('homePincode');
        if (addrInput) addrInput.value = Store.get('custLocation', '');
        if (pincodeInput) pincodeInput.value = Store.get('custPincode', '');

        // Auto-save address/pincode to Store on input
        if (addrInput) {
          addrInput.addEventListener('input', () => {
            Store.set('custLocation', addrInput.value);
          });
        }
        if (pincodeInput) {
          pincodeInput.addEventListener('input', () => {
            const filtered = pincodeInput.value.replace(/[^0-9]/g, '').slice(0, 6);
            pincodeInput.value = filtered;
            Store.set('custPincode', filtered);
          });
        }

        // Initialize Google Places Autocomplete for home address
        if (typeof window.GOOGLE_MAPS_LOADED !== 'undefined') {
          window.GOOGLE_MAPS_LOADED.then(() => {
            if (addrInput && typeof google !== 'undefined' && google.maps?.places) {
              const autocomplete = new google.maps.places.Autocomplete(addrInput, {
                types: ['geocode', 'establishment'],
                componentRestrictions: { country: 'in' },
                fields: ['formatted_address', 'name', 'address_components'],
              });
              autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place && place.formatted_address) {
                  addrInput.value = place.formatted_address;
                  Store.set('custLocation', place.formatted_address);
                }
              });
            }
          }).catch(() => {});
        }

        // ── Generate next 14 days ──
        function generateDates() {
          const days = [];
          const today = new Date();
          for (let i = 0; i < 14; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            days.push(d);
          }
          return days;
        }

        function getAppointmentTime(date, slot) {
          const startHour = parseInt(slot.split(' - ')[0].split(':')[0], 10);
          const startMin = parseInt(slot.split(' - ')[0].split(':')[1], 10);
          const t = new Date(date);
          t.setHours(startHour, startMin, 0, 0);
          return t.getTime();
        }

        function formatDate(d) {
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        function renderApptDates() {
          const row = document.getElementById('apptDateRow');
          if (!row) return;
          const dates = generateDates();
          row.innerHTML = dates.map((d, i) => {
            const dateStr = d.toISOString();
            const isSel = selectedDate && d.toDateString() === selectedDate.toDateString();
            return `
              <div class="date-card${isSel ? ' active' : ''}" data-date="${dateStr}" onclick="window.selectApptDate('${dateStr}')">
                <div class="date-day${isSel ? ' active' : ''}">${DAYS[d.getDay()]}</div>
                <div class="date-num${isSel ? ' active' : ''}">${d.getDate()}</div>
                <div class="date-month${isSel ? ' active' : ''}">${MONTHS[d.getMonth()]}</div>
              </div>
            `;
          }).join('');
        }

        window.toggleAppointment = () => {
          wantAppointment = !wantAppointment;
          if (!wantAppointment) {
            selectedDate = null;
            selectedSlot = null;
          }
          const section = document.getElementById('apptDateTimeSection');
          const arrow = document.getElementById('apptToggleArrow');
          const toggle = document.getElementById('apptToggle');
          const submitText = document.getElementById('submitBtnText');
          if (wantAppointment) {
            section.style.display = 'block';
            arrow.textContent = '▼';
            toggle.classList.add('active');
            renderApptDates();
            updateSubmitBtnText();
          } else {
            section.style.display = 'none';
            arrow.textContent = '▶';
            toggle.classList.remove('active');
            if (submitText) submitText.textContent = '📋 Submit Repair Request';
          }
        };

        window.selectApptDate = (dateStr) => {
          selectedDate = new Date(dateStr);
          selectedSlot = null;
          document.querySelectorAll('#apptDateRow .date-card').forEach(c => c.classList.remove('active'));
          const card = document.querySelector(`#apptDateRow .date-card[data-date="${dateStr}"]`);
          if (card) card.classList.add('active');
          document.querySelectorAll('#apptSlotsGrid .slot-btn').forEach(s => s.classList.remove('active'));
          updateSubmitBtnText();
        };

        window.selectApptSlot = (slot) => {
          selectedSlot = slot;
          document.querySelectorAll('#apptSlotsGrid .slot-btn').forEach(s => s.classList.remove('active'));
          const btn = document.querySelector(`#apptSlotsGrid .slot-btn[data-slot="${slot}"]`);
          if (btn) btn.classList.add('active');
          updateSubmitBtnText();
        };

        function updateSubmitBtnText() {
          const submitText = document.getElementById('submitBtnText');
          if (!submitText) return;
          if (wantAppointment && selectedDate && selectedSlot) {
            submitText.textContent = '📅 Book Appointment & Submit →';
          } else {
            submitText.textContent = '📋 Submit Repair Request';
          }
        }

        window.selectQuickRepair = (repair) => {
          // No longer used - kept for compatibility
        };

        window.submitRepair = () => {
          const desc = document.getElementById('descriptionInput')?.value?.trim();
          if (!desc) {
            showAlert('Missing', 'Please describe your issue.');
            return;
          }
          window.bookRepair(desc);
        };

        window.bookRepair = async (repair) => {
          const name = Store.get('custName', 'Customer');
          // Save address & pincode from inputs
        const addrInput = document.getElementById('homeAddress');
        const pincodeInput = document.getElementById('homePincode');
        const addr = addrInput ? addrInput.value.trim() : Store.get('custLocation', 'Your Location');
        const pin = pincodeInput ? pincodeInput.value.trim() : Store.get('custPincode', '');
        Store.set('custLocation', addr);
        Store.set('custPincode', pin);

        const loc = addr;
        const phone = Store.get('custPhone', '');
        const pushToken = Store.get('pushToken', '');
        Store.set('lastBrand', selectedBrand);
        Store.set('lastRepair', repair);

        const pos = await getCurrentPositionOnce();
        try { firebase.database().ref('custLocation').set({ lat: pos.lat, lng: pos.lng }); } catch (e) {}

        const pincode = pin;

          // ── Appointment data (if customer opted in) ──
          const hasAppt = wantAppointment && selectedDate && selectedSlot;
          let appointmentTime = null;
          if (hasAppt) {
            appointmentTime = getAppointmentTime(selectedDate, selectedSlot);
          }

          const order = {
            customerName: name,
            customerPhone: phone,
            customerPushToken: pushToken,
            location: loc,
          pincode: pincode,
          brand: selectedBrand,
            repair: repair,
            status: 'pending',
            time: hasAppt ? selectedSlot : new Date().toLocaleTimeString(),
            // GPS coordinates for distance-based technician matching
            custLat: pos ? pos.lat : null,
            custLng: pos ? pos.lng : null,
            // ── Optional appointment fields ──
            ...(hasAppt && {
              isAppointment: true,
              appointmentTime,
              date: formatDate(selectedDate),
              dateLabel: `${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}`,
              timeSlot: selectedSlot,
              reminderSent: false,
            }),
          };
          try {
            const newRef = firebase.database().ref('orders').push(order);
            const orderId = newRef.key;
            Store.set('lastOrderId', orderId);

            // Capture appointment alert values BEFORE resetting state
            const apptDay = hasAppt ? DAYS[selectedDate.getDay()] : '';
            const apptNum = hasAppt ? selectedDate.getDate() : '';
            const apptMon = hasAppt ? MONTHS[selectedDate.getMonth()] : '';
            const apptSlot = hasAppt ? selectedSlot : '';

            const alertMsg = hasAppt
              ? `Brand: ${selectedBrand}\nRepair: ${repair}\nDate: ${apptDay}, ${apptNum} ${apptMon}\nTime: ${apptSlot}\n\nWe'll send a reminder before your appointment!`
              : `Brand: ${selectedBrand}\nRepair: ${repair}\n\nTrack your technician?`;

            // Reset appointment state (after capturing values)
            wantAppointment = false;
            selectedDate = null;
            selectedSlot = null;
            const apptSection = document.getElementById('apptDateTimeSection');
            if (apptSection) apptSection.style.display = 'none';
            const toggleArrow = document.getElementById('apptToggleArrow');
            if (toggleArrow) toggleArrow.textContent = '▶';
            const toggleEl = document.getElementById('apptToggle');
            if (toggleEl) toggleEl.classList.remove('active');
            const submitText = document.getElementById('submitBtnText');
            if (submitText) submitText.textContent = '📋 Submit Repair Request';

            // Show a browser notification for booking confirmation
            showCustBrowserNotification(
              hasAppt ? '✅ Appointment Booked!' : '✅ Booking Confirmed!',
              `Your ${selectedBrand} ${repair} repair request has been submitted. We'll notify you when a technician accepts!`,
              orderId,
              'default'
            );
            showAlert(hasAppt ? '✅ Appointment Booked!' : '✅ Booking Confirmed!', alertMsg, [
              { text: 'Track Now', onPress: () => Router.navigate('tracking') },
              { text: '💬 Chat', onPress: () => Router.navigate('chat', { orderId, role: 'cust', customerName: name, techName: '' }) },
              { text: 'Later' }
            ]);
          } catch (e) { showAlert('Error', 'Booking failed! Try again.'); }
        };

        return () => {
          if (ordersUnsub) ordersUnsub();
          if (techLocUnsub) techLocUnsub();
          if (custLocUnsub) custLocUnsub();
          delete window.switchCustTab;
          delete window.selectDevice;
          delete window.selectBrand;
          delete window.bookRepair;
          delete window.toggleAppointment;
          delete window.selectApptDate;
          delete window.selectApptSlot;
        };
      }
    };
  }
});
