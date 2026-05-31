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
        let notifiedTechAssigned = false; // track if we've notified customer about tech assignment
        let notifiedJobComplete = false; // track if we've notified customer about job completion
        let notifiedTechNearby = false; // track if we've notified customer tech is nearby
        let isFirstTrackingLoad = true;  // skip notifications on initial page load
        const SPEED = 0.3; // km/min (~18 km/h — realistic city speed)

        // ── Request browser notification permission ──────────────────────────────
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }

        function playNotifSound(type) {
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (type === 'tech-assigned') {
              // Two ascending beeps — someone is coming!
              const osc1 = ctx.createOscillator();
              const g1 = ctx.createGain();
              osc1.connect(g1); g1.connect(ctx.destination);
              osc1.frequency.value = 660;
              g1.gain.setValueAtTime(0.12, ctx.currentTime);
              g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
              osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.15);

              const osc2 = ctx.createOscillator();
              const g2 = ctx.createGain();
              osc2.connect(g2); g2.connect(ctx.destination);
              osc2.frequency.value = 880;
              g2.gain.setValueAtTime(0.12, ctx.currentTime + 0.2);
              g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
              osc2.start(ctx.currentTime + 0.2); osc2.stop(ctx.currentTime + 0.35);
            } else if (type === 'tech-nearby') {
              // Three rapid beeps — alert!
              for (let i = 0; i < 3; i++) {
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.connect(g); g.connect(ctx.destination);
                osc.frequency.value = 520;
                const t = ctx.currentTime + i * 0.18;
                g.gain.setValueAtTime(0.12, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                osc.start(t); osc.stop(t + 0.1);
              }
            } else if (type === 'job-complete') {
              // Two descending beeps — satisfying done sound
              const osc1 = ctx.createOscillator();
              const g1 = ctx.createGain();
              osc1.connect(g1); g1.connect(ctx.destination);
              osc1.frequency.value = 880;
              g1.gain.setValueAtTime(0.12, ctx.currentTime);
              g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
              osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.2);

              const osc2 = ctx.createOscillator();
              const g2 = ctx.createGain();
              osc2.connect(g2); g2.connect(ctx.destination);
              osc2.frequency.value = 660;
              g2.gain.setValueAtTime(0.12, ctx.currentTime + 0.25);
              g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
              osc2.start(ctx.currentTime + 0.25); osc2.stop(ctx.currentTime + 0.45);
            }
          } catch (e) {}
        }

        function showCustBrowserNotification(title, body, onClickUrl, tag, soundType) {
          if (!('Notification' in window) || Notification.permission !== 'granted') return;
          try {
            const notif = new Notification(title, {
              body,
              icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔧</text></svg>',
              tag: tag || 'cust-notification',
              requireInteraction: true,
            });
            notif.onclick = () => {
              window.focus();
              if (onClickUrl) Router.navigate(onClickUrl);
              notif.close();
            };
            // Play event-specific notification sound
            playNotifSound(soundType || 'default');
          } catch (e) {}
        }

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

          // ── Proximity check: notify customer when tech is within 1km ──
          if (!isFirstTrackingLoad && techNameVal !== 'Technician' && !jobDone && !notifiedTechNearby) {
            const d = parseFloat(calcDistance(custLat, custLng, techLat, techLng));
            if (!isNaN(d) && d <= 1.0) {
              notifiedTechNearby = true;
              showCustBrowserNotification(
                '🚗 Technician Nearby!',
                `${techNameVal} is less than 1 km from your location — almost there!`,
                'tracking',
                'cust-tech-nearby',
                'tech-nearby'
              );
            }
          }
        };
        techLocRef.on('value', onTechLoc);

        // Listen for orders — get tech info directly from this customer's order (not from shared techInfo)
        const ordersRef = firebase.database().ref('orders');
        const onOrders = (snap) => {
          if (!snap.exists()) return;
          snap.forEach(child => {
            const o = child.val();
            // Read tech name/phone from this customer's order (not from shared techInfo which gets overwritten)
            if (child.key === orderId) {
              if (o.techName) {
                // First time tech is assigned (not on initial load) → show browser notification
                if (!isFirstTrackingLoad && !notifiedTechAssigned && techNameVal !== o.techName) {
                  notifiedTechAssigned = true;
                  showCustBrowserNotification(
                    '🛵 Technician Assigned!',
                    `${o.techName} is on the way to fix your ${o.brand} ${o.repair}!`,
                    'tracking',
                    'cust-tech-assigned',
                    'tech-assigned'
                  );
                }
                techNameVal = o.techName;
                techPhone = o.techPhone || '';
                document.getElementById('techName').textContent = techNameVal;
                document.getElementById('callTechBtn').textContent = '📞 Call ' + techNameVal;
              }
              if (o.status === 'completed') {
                // Notify customer when job is marked complete (skip initial load)
                if (!isFirstTrackingLoad && !notifiedJobComplete) {
                  notifiedJobComplete = true;
                  showCustBrowserNotification(
                    '✅ Repair Completed!',
                    `Your ${o.brand} ${o.repair} is done! Please rate your experience.`,
                    'review',
                    'cust-job-complete',
                    'job-complete'
                  );
                }
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
            }
          });
          isFirstTrackingLoad = false; // done with initial load, future callbacks are real updates
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

          ordersRef.off('value', onOrders);
          delete window.callTech;
          delete window.goToChat;
          if (map) { map.remove(); window._currentMap = null; }
        };
      }
    };
  }
});
