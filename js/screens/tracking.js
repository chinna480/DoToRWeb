// Tracking Screen - Bento Glass live tracking
Router.register('tracking', {
  render() {
    const brand = Store.get('lastBrand', '-');
    const repair = Store.get('lastRepair', '-');
    const location = Store.get('custLocation', '-');
    return {
      html: `
        <div class="screen">
          <!-- Bento Glass Tracking Header -->
          <div class="tracking-header">
            <div>
              <div style="font-size:20px;font-weight:800;color:#fff">🛵 Order Tracking</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.9);margin-top:3px" id="trackStatus">⏳ Order Placed</div>
            </div>
            <div class="tracking-pill glass-strong" id="trackPill" style="background:rgba(255,107,0,0.3)">
              <span class="tracking-pill-text" id="trackPillText">🟢 Active</span>
            </div>
          </div>
          
          <!-- Live Map -->
          <div id="trackingMap" class="tracking-map"></div>
          
          <div class="scroll-content">
            <!-- Location Cards -->
            <div class="loc-row">
              <div class="loc-card glass">
                <div class="loc-icon">📍</div>
                <div class="loc-label">YOUR LOCATION</div>
                <div class="loc-name">${location}</div>
              </div>
            </div>

            <!-- Order Details Glass Card -->
            <div class="glass" style="padding:18px;margin-bottom:12px">
              <div class="card-title">📋 ORDER DETAILS</div>
              <div class="info-row"><span class="info-label">📱 Device</span><span class="info-value" id="trackBrand">${brand}</span></div>
              <div class="info-row"><span class="info-label">🔧 Repair</span><span class="info-value" id="trackRepair">${repair}</span></div>
              <div class="info-row"><span class="info-label">📍 Location</span><span class="info-value">${location}</span></div>
            </div>

            <!-- Progress Stepper Glass Card -->
            <div class="glass" style="padding:18px;margin-bottom:12px">
              <div class="card-title">📦 ORDER STATUS</div>
              <div id="statusSteps">
                <div class="step"><div class="dot dot-done"></div><span class="step-label">✅ Order Placed</span></div>
                <div class="step"><div class="dot dot-pending" id="stepAssigned"></div><span class="step-label">🛵 Technician Assigned</span></div>
                <div class="step"><div class="dot dot-pending" id="stepInProgress"></div><span class="step-label">🔧 Repair In Progress</span></div>
                <div class="step"><div class="dot dot-pending" id="stepDone"></div><span class="step-label">✅ Repair Completed</span></div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="active-booking-actions" style="margin:0 0 12px">
              <button class="btn btn-success btn-sm" onclick="window.trackCallTech()">📞 Call</button>
              <button class="btn btn-primary btn-sm" onclick="window.trackChat()">💬 Message</button>
            </div>

            <!-- Review Button -->
            <button class="btn btn-success btn-block" id="reviewBtn" style="display:none" onclick="Router.navigate('review')">⭐ Rate Your Experience</button>
          </div>
        </div>
      `,
      init() {
        let map = null;
        let custMarker = null;
        let orderId = Store.get('lastOrderId', '');
        let jobDone = false;
        const defaultLat = 17.3850, defaultLng = 78.4867;
        let custLat = defaultLat, custLng = defaultLng;

        // Initialize Leaflet map
        map = L.map('trackingMap').setView([defaultLat, defaultLng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);
        window._currentMap = map;

        custMarker = L.marker([defaultLat, defaultLng]).addTo(map)
          .bindPopup('📍 Your Location');

        // Start GPS to show customer location
        startGPS((lat, lng) => {
          custLat = lat; custLng = lng;
          custMarker.setLatLng([lat, lng]);
          firebase.database().ref('custLocation').set({ lat, lng }).catch(() => {});
          map.setView([lat, lng], map.getZoom());
        });

        // Listen for order updates
        const ordersRef = firebase.database().ref('orders');
        const onOrders = (snap) => {
          if (!snap.exists()) return;
          snap.forEach(child => {
            const order = child.val();
            if (order.status === 'assigned') {
              document.getElementById('stepAssigned').className = 'dot dot-done';
            }
            if (order.status === 'accepted' || order.status === 'assigned') {
              document.getElementById('trackStatus').textContent = '🔧 Repair In Progress';
              document.getElementById('trackPill').style.background = 'rgba(255,107,0,0.3)';
              document.getElementById('trackPillText').textContent = '🟢 Active';
              document.getElementById('stepAssigned').className = 'dot dot-done';
              document.getElementById('stepInProgress').className = 'dot dot-done';
            }
            if (order.status === 'completed') {
              jobDone = true;
              document.getElementById('trackStatus').textContent = '✅ Repair Completed!';
              document.getElementById('trackPill').style.background = 'rgba(46,125,50,0.3)';
              document.getElementById('trackPillText').textContent = '✅ Done';
              document.getElementById('stepAssigned').className = 'dot dot-done';
              document.getElementById('stepInProgress').className = 'dot dot-done';
              document.getElementById('stepDone').className = 'dot dot-done';
              document.getElementById('reviewBtn').style.display = 'flex';
            }
          });
        };
        ordersRef.on('value', onOrders);

        window.trackCallTech = () => {
          if (!orderId) { showAlert('No Booking', 'No active booking found.'); return; }
          firebase.database().ref('orders/' + orderId).once('value').then(snap => {
            if (!snap.exists()) { showAlert('No Booking', 'No active booking found.'); return; }
            const order = snap.val();
            const techPhone = order.techPhone || '';
            if (techPhone) { window.open('tel:+91' + techPhone); }
            else showAlert('Not Available', 'Technician phone not available yet!');
          });
        };

        window.trackChat = () => {
          if (orderId) {
            Router.navigate('chat', { orderId, role: 'cust', customerName: Store.get('custName', 'User') });
          }
        };

        return () => {
          stopGPS();
          ordersRef.off('value', onOrders);
          if (map) { map.remove(); window._currentMap = null; }
          delete window.trackCallTech;
          delete window.trackChat;
        };
      }
    };
  }
});
