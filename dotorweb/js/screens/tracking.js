// Tracking Screen - Customer viewing technician's location
Router.register('tracking', {
  render() {
    const brand = Store.get('lastBrand', '-');
    const repair = Store.get('lastRepair', '-');
    const location = Store.get('custLocation', '-');
    return {
      html: `
        <div class="screen">
          <div class="tracking-header">
            <div>
              <div style="font-size:20px;font-weight:800;color:#fff">🛵 Live Tracking</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.9);margin-top:3px" id="trackStatus">⏳ Waiting for technician...</div>
            </div>
            <div class="tracking-pill" id="trackPill" style="background:#FF6B00">
              <span class="tracking-pill-text" id="trackPillText">🟢 Live</span>
            </div>
          </div>
          <div id="trackingMap" class="tracking-map"></div>
          <div class="scroll-content">
            <div class="dist-banner">
              <div>
                <div class="dist-label">Distance</div>
                <div class="dist-value" id="trackDistance">--</div>
              </div>
              <div class="eta-pill">
                <span class="eta-text" id="trackEta">ETA: --</span>
              </div>
            </div>
            <div class="loc-row">
              <div class="loc-card">
                <div class="loc-icon">🏠</div>
                <div class="loc-label">YOUR LOCATION</div>
                <div class="loc-name">${location}</div>
              </div>
              <div class="loc-card">
                <div class="loc-icon">🛵</div>
                <div class="loc-label">TECHNICIAN</div>
                <div class="loc-name" id="techStatusText">Waiting...</div>
              </div>
            </div>
            <div class="card">
              <div class="card-title">YOUR TECHNICIAN</div>
              <div class="tech-row">
                <div class="tech-avatar"><span style="font-size:26px">👨‍🔧</span></div>
                <div style="flex:1">
                  <div class="tech-name" id="techName">Connecting...</div>
                  <div class="tech-sub">⭐ Verified Expert Technician</div>
                </div>
                <div class="rating-badge"><span class="rating-text">⭐ 4.8</span></div>
              </div>
            </div>
            <div class="card">
              <div class="card-title">ORDER DETAILS</div>
              <div class="info-row"><span class="info-label">Device</span><span class="info-value" id="trackBrand">${brand}</span></div>
              <div class="info-row"><span class="info-label">Repair</span><span class="info-value" id="trackRepair">${repair}</span></div>
              <div class="info-row"><span class="info-label">Location</span><span class="info-value">${location}</span></div>
            </div>
            <div class="card">
              <div class="card-title">LIVE STATUS</div>
              <div id="statusSteps">
                <div class="step"><div class="dot dot-done"></div><span class="step-label">✅ Order Confirmed</span></div>
                <div class="step"><div class="dot dot-pending" id="stepTechOnWay"></div><span class="step-label">🚗 Technician On The Way</span></div>
                <div class="step"><div class="dot dot-pending" id="stepInProgress"></div><span class="step-label">🔧 Repair In Progress</span></div>
                <div class="step"><div class="dot dot-pending" id="stepDone"></div><span class="step-label">✅ Repair Done!</span></div>
              </div>
            </div>
            <button class="btn btn-dark btn-block" onclick="window.callTech()" id="callTechBtn">📞 Call Technician</button>
            <div class="action-row">
              <button class="btn btn-primary btn-block" onclick="window.goToChat()">💬 Chat with Technician</button>
              <button class="btn btn-success btn-block" id="reviewBtn" style="display:none" onclick="Router.navigate('review')">⭐ Rate Your Experience</button>
            </div>
          </div>
        </div>
      `,
      init() {
        let map = null;
        let custMarker = null;
        let techMarker = null;
        let polyline = null;
        let techPhone = '';
        let techNameVal = 'Technician';
        let orderId = Store.get('lastOrderId', '');
        let jobDone = false;
        const defaultLat = 17.3850, defaultLng = 78.4867;
        let custLat = defaultLat, custLng = defaultLng;
        let techLat = null, techLng = null;
        let hasTechLocation = false;
        const SPEED = 0.3; // km/min (~18 km/h — realistic city speed)

        // Initialize Leaflet map
        map = L.map('trackingMap').setView([defaultLat, defaultLng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);
        window._currentMap = map;

        custMarker = L.marker([defaultLat, defaultLng]).addTo(map)
          .bindPopup('🏠 Your Location');

        // Start GPS
        startGPS((lat, lng) => {
          custLat = lat; custLng = lng;
          custMarker.setLatLng([lat, lng]);
          firebase.database().ref('custLocation').set({ lat, lng }).catch(() => {});
          map.setView([lat, lng], map.getZoom());
          updateDistanceDisplay();
        });

        // Listen for technician location
        const techLocRef = firebase.database().ref('techLocation');
        const onTechLoc = (snap) => {
          if (!snap.exists()) return;
          const { lat, lng } = snap.val();
          techLat = lat; techLng = lng;
          hasTechLocation = true;
          if (!techMarker) {
            techMarker = L.marker([lat, lng], { icon: L.divIcon({ className: '', html: '🛵', iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(map)
              .bindPopup('🛵 Technician');
          } else {
            techMarker.setLatLng([lat, lng]);
          }
          if (!polyline) {
            polyline = L.polyline([[custLat, custLng], [lat, lng]], { color: '#FF6B00', weight: 3, dashArray: '8,8' }).addTo(map);
          } else {
            polyline.setLatLngs([[custLat, custLng], [lat, lng]]);
          }
          document.getElementById('trackStatus').textContent = '🛵 Technician is on the way!';
          document.getElementById('techStatusText').textContent = 'On the way';
          updateDistanceDisplay();

          // Update map bounds
          const bounds = L.latLngBounds([custLat, custLng], [lat, lng]);
          map.fitBounds(bounds, { padding: [50, 50] });

          // Update steps
          document.getElementById('stepTechOnWay').className = 'dot dot-done';
        };
        techLocRef.on('value', onTechLoc);

        // Listen for technician info
        const techInfoRef = firebase.database().ref('techInfo');
        const onTechInfo = (snap) => {
          if (!snap.exists()) return;
          const info = snap.val();
          techNameVal = info.name || 'Technician';
          techPhone = info.phone || '';
          document.getElementById('techName').textContent = techNameVal;
          document.getElementById('callTechBtn').textContent = '📞 Call ' + techNameVal;
        };
        techInfoRef.on('value', onTechInfo);

        // Listen for completed orders
        const ordersRef = firebase.database().ref('orders');
        const onOrders = (snap) => {
          if (!snap.exists()) return;
          snap.forEach(child => {
            if (child.val().status === 'completed') {
              jobDone = true;
              document.getElementById('trackStatus').textContent = '✅ Repair Completed!';
              document.getElementById('trackPill').style.background = '#2e7d32';
              document.getElementById('trackPillText').textContent = '✅ Done';
              document.getElementById('stepInProgress').className = 'dot dot-done';
              document.getElementById('stepDone').className = 'dot dot-done';
              document.getElementById('reviewBtn').style.display = 'flex';
              if (techMarker) { map.removeLayer(techMarker); techMarker = null; }
              if (polyline) { map.removeLayer(polyline); polyline = null; }
            }
          });
        };
        ordersRef.on('value', onOrders);

        function updateDistanceDisplay() {
          if (!hasTechLocation || !techLat) return;
          const d = parseFloat(calcDistance(custLat, custLng, techLat, techLng));
          document.getElementById('trackDistance').textContent = d + ' km';
          const etaMins = Math.round(d / SPEED);
          document.getElementById('trackEta').textContent = '~' + Math.max(1, etaMins) + ' mins';
          if (polyline) {
            polyline.setLatLngs([[custLat, custLng], [techLat, techLng]]);
          }
          if (techMarker) {
            techMarker.setLatLng([techLat, techLng]);
          }
        }

        window.callTech = () => {
          if (techPhone) {
            window.open('tel:+91' + techPhone);
          } else {
            showAlert('Not Available', 'Technician phone not available yet! Please wait.');
          }
        };

        window.goToChat = () => {
          Router.navigate('chat', { orderId, role: 'cust', techName: techNameVal, customerName: Store.get('custName', 'Customer') });
        };

        return () => {
          stopGPS();
          techLocRef.off('value', onTechLoc);
          techInfoRef.off('value', onTechInfo);
          ordersRef.off('value', onOrders);
          delete window.callTech;
          delete window.goToChat;
          if (map) { map.remove(); window._currentMap = null; }
        };
      }
    };
  }
});
