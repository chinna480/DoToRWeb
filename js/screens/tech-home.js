// Tech Home Screen - Technician job management
Router.register('tech-home', {
  render() {
    const name = Store.get('techName', 'Technician');
    const loc = Store.get('techLocation', 'Your Location');
    return {
      html: `
        <div class="screen">
          <div class="tech-header">
            <div>
              <div class="tech-greeting">Welcome Back! 👋</div>
              <div class="tech-name-text">${name}</div>
              <div class="tech-loc-text">📍 ${loc}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
              <button class="tech-avatar-btn" onclick="Router.navigate('tech-profile')">
                <span style="font-size:24px">🔧</span>
              </button>
              <button class="online-pill active" id="onlineBtn" onclick="window.toggleOnline()">
                🟢 Online
              </button>
              <button style="background:none;border:none;color:rgba(255,255,255,0.8);font-size:11px;font-weight:800;cursor:pointer" onclick="window.techLogout()">Logout</button>
            </div>
          </div>
          <div class="earnings-row">
            <div class="earn-card"><div class="earn-label">Today's Jobs</div><div class="earn-value" id="totalJobs">0</div></div>
            <div class="earn-card"><div class="earn-label">Pending</div><div class="earn-value" id="pendingCount">0</div></div>
            <div class="earn-card"><div class="earn-label">Status</div><div class="earn-value earn-value-sm" id="techStatus">🟢 Active</div></div>
          </div>
          <div class="section-title">📋 Pending Jobs <span style="font-size:12px;font-weight:400;color:var(--gray)" id="areaTag"></span></div>
          <div id="pendingJobs">
            <div class="empty-card"><span class="empty-text">No new jobs right now</span></div>
          </div>
          <div class="section-title">📅 Scheduled Appointments <span style="font-size:12px;font-weight:400;color:var(--gray)" id="scheduledCount"></span></div>
          <div id="scheduledAppointments">
            <div class="empty-card"><span class="empty-text">No scheduled appointments</span></div>
          </div>
          <div class="section-title">🔧 Ongoing Job</div>
          <div id="ongoingJob">
            <div class="empty-card"><span class="empty-text">No ongoing job right now</span></div>
          </div>
          <div class="section-title">✅ Completed Jobs</div>
          <div id="completedJobs">
            <div class="empty-card"><span class="empty-text">No completed jobs yet</span></div>
          </div>
          <div style="height:40px"></div>
        </div>
      `,
      init() {
        let isOnline = true;
        let ongoingOrder = null;
        let custLat = null, custLng = null;
        let myLat = 17.3850, myLng = 78.4867;
        let prevPendingIds = new Set();
        let map = null, custMarker = null, myMarker = null, polyline = null;
        let techPushToken = Store.get('pushToken', '');

        const techArea = Store.get('techLocation', '').toLowerCase().trim();
        const techPincode = Store.get('techPincode', '').trim();

        function matchesLocation(order) {
          // If tech has no location set, show all orders
          if (!techArea && !techPincode) return true;

          const orderPincode = (order.pincode || '').trim();
          const orderArea = (order.location || '').toLowerCase().trim();

          // If tech has both area and pincode, both must match
          if (techArea && techPincode) {
            return orderArea === techArea && orderPincode === techPincode;
          }

          // If tech has only pincode, match by pincode
          if (techPincode) {
            return orderPincode === techPincode;
          }

          // If tech has only area, match by area (backward compat)
          return orderArea === techArea;
        }

        function renderPending(pending) {
          const el = document.getElementById('pendingJobs');
          if (pending.length === 0) {
            el.innerHTML = '<div class="empty-card"><span class="empty-text">No new jobs right now</span></div>';
            document.getElementById('pendingCount').textContent = '0';
            return;
          }
          document.getElementById('pendingCount').textContent = pending.length;
          el.innerHTML = pending.map(o => `
            <div class="job-card pending">
              <div class="job-new-badge">NEW</div>
              <div class="job-customer">👤 ${o.customerName}</div>
              <div class="job-type">📱 ${o.brand} — ${o.repair}</div>
              <div class="job-location">📍 ${o.location}</div>
              <div class="job-time">🕐 ${o.time}</div>
              <div class="job-actions">
                <button class="btn btn-sm btn-danger" onclick="window.rejectJob('${o.id}')" style="flex:1">✕ Reject</button>
                <button class="btn btn-sm btn-dark" onclick="window.acceptJob('${o.id}')" style="flex:1">✓ Accept</button>
              </div>
            </div>
          `).join('');
        }

        function renderOngoing(order) {
          const el = document.getElementById('ongoingJob');
          if (!order) {
            el.innerHTML = '<div class="empty-card"><span class="empty-text">No ongoing job right now</span></div>';
            if (map) { map.remove(); map = null; window._currentMap = null; }
            stopGPS();
            return;
          }
          const distance = (custLat && myLat) ? calcDistance(myLat, myLng, custLat, custLng) + ' km' : '--';
          const eta = (custLat && myLat) ? '~' + Math.round(parseFloat(distance) / 0.5) + ' mins' : '--';

          el.innerHTML = `
            <div class="ongoing-card">
              <div class="job-customer">👤 ${order.customerName}</div>
              <div class="job-type">📱 ${order.brand} — ${order.repair}</div>
              <div class="job-location">📍 ${order.location}</div>
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

          // Initialize map
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

        function renderScheduled(scheduled) {
          const el = document.getElementById('scheduledAppointments');
          const countEl = document.getElementById('scheduledCount');
          if (scheduled.length === 0) {
            el.innerHTML = '<div class="empty-card"><span class="empty-text">No scheduled appointments</span></div>';
            if (countEl) countEl.textContent = '';
            return;
          }
          if (countEl) countEl.textContent = `(${scheduled.length})`;
          el.innerHTML = scheduled.map(o => `
            <div class="job-card pending" style="border-left-color:var(--dark)">
              <div class="job-new-badge" style="background:var(--dark)">📅 Appointment</div>
              <div class="job-customer">👤 ${o.customerName}</div>
              <div class="job-type" style="color:var(--dark)">📅 ${o.dateLabel || 'Scheduled'}</div>
              <div class="job-type">🕐 ${o.time || o.repair?.replace('Appointment: ', '') || '--'}</div>
              <div class="job-location">📍 ${o.location}</div>
              <div class="job-actions">
                <button class="btn btn-sm btn-danger" onclick="window.rejectAppointment('${o.id}')" style="flex:1">✕ Reject</button>
                <button class="btn btn-sm btn-primary" onclick="window.acceptAppointment('${o.id}')" style="flex:1">✓ Accept</button>
              </div>
            </div>
          `).join('');
        }

        function renderCompleted(completed) {
          const el = document.getElementById('completedJobs');
          if (completed.length === 0) {
            el.innerHTML = '<div class="empty-card"><span class="empty-text">No completed jobs yet</span></div>';
            return;
          }
          el.innerHTML = completed.map(o => `
            <div class="completed-card">
              <div class="comp-left">
                <div class="comp-customer">👤 ${o.customerName}</div>
                <div class="comp-type">📱 ${o.brand} — ${o.repair}</div>
              </div>
              <div class="comp-right">
                <div class="comp-done">✅ Done</div>
                <div class="comp-time-small">${o.time || ''}</div>
              </div>
            </div>
          `).join('');
        }

        // Show area/pincode filter tag
        const myArea = Store.get('techLocation', '');
        const myPincode = Store.get('techPincode', '');
        const areaTag = document.getElementById('areaTag');
        if (areaTag) {
          const tagParts = [];
          if (myArea) tagParts.push('📍 ' + myArea);
          if (myPincode) tagParts.push('📮 ' + myPincode);
          areaTag.textContent = tagParts.length ? tagParts.join(' · ') : '';
        }

        // Listen for orders
        const ordersRef = firebase.database().ref('orders');
        const onOrders = (snap) => {
          const pending = [], scheduled = [], completed = [];
          let ongoing = null, count = 0;

          snap.forEach(child => {
            const order = { id: child.key, ...child.val() };
            if (order.status === 'scheduled' && order.isAppointment && matchesLocation(order)) {
              scheduled.push(order);
            }
            if (order.status === 'pending' && matchesLocation(order)) {
              pending.push(order);
            }
            if (order.status === 'accepted') ongoing = order;
            if (order.status === 'completed') { completed.push(order); count++; }
          });

          // Notify for new pending jobs
          pending.forEach(o => {
            if (!prevPendingIds.has(o.id)) {
              // Could show browser notification here
            }
          });
          prevPendingIds = new Set(pending.map(o => o.id));

          document.getElementById('totalJobs').textContent = count;
          renderPending(pending);
          renderScheduled(scheduled);
          renderCompleted(completed);

          if (ongoing && (!ongoingOrder || ongoingOrder.id !== ongoing.id)) {
            ongoingOrder = ongoing;
            startLocationSharing();
          } else if (!ongoing) {
            ongoingOrder = null;
            renderOngoing(null);
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
            renderOngoing(ongoingOrder);
            updateDistanceAndEta();
          }
        };
        custLocRef.on('value', onCustLoc);

        function updateDistanceAndEta() {
          if (!custLat || !myLat || !ongoingOrder) return;
          const d = parseFloat(calcDistance(myLat, myLng, custLat, custLng));
          const etaMins = Math.round(d / 0.5);
          document.getElementById('techDistance').textContent = d + ' km';
          document.getElementById('techEta').textContent = '~' + etaMins + ' mins';
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
          Store.set('currentOrderId', orderId);
          firebase.database().ref('techInfo').set({ name, location: loc, phone });
          firebase.database().ref('orders/' + orderId).update({ status: 'accepted' })
            .then(() => showAlert('✅ Job Accepted!', 'Customer can now track you!'))
            .catch(() => showAlert('Error', 'Failed to accept. Try again!'));
        };

        window.rejectJob = (orderId) => {
          showAlert('Reject Job?', 'Are you sure?', [
            { text: 'Cancel' },
            { text: 'Reject', style: 'destructive', onPress: () => firebase.database().ref('orders/' + orderId).update({ status: 'rejected' }) }
          ]);
        };

        window.acceptAppointment = (orderId) => {
          const name = Store.get('techName', 'Technician');
          const loc = Store.get('techLocation', '');
          const phone = Store.get('techPhone', '');
          Store.set('currentOrderId', orderId);
          firebase.database().ref('techInfo').set({ name, location: loc, phone });
          firebase.database().ref('orders/' + orderId).update({ status: 'accepted', brand: 'Appointment', techPhone: phone })
            .then(() => showAlert('✅ Appointment Accepted!', 'Customer will be notified.\n\nStart heading to their location!'))
            .catch(() => showAlert('Error', 'Failed to accept. Try again!'));
        };

        window.rejectAppointment = (orderId) => {
          showAlert('Reject Appointment?', 'Are you sure?', [
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

        window.toggleOnline = () => {
          isOnline = !isOnline;
          const btn = document.getElementById('onlineBtn');
          const status = document.getElementById('techStatus');
          if (isOnline) {
            btn.className = 'online-pill active';
            btn.textContent = '🟢 Online';
            status.textContent = '🟢 Active';
          } else {
            btn.className = 'online-pill inactive';
            btn.textContent = '🔴 Offline';
            status.textContent = '🔴 Off';
          }
        };

        window.techLogout = () => {
          showAlert('Logout?', 'Are you sure?', [
            { text: 'Cancel' },
            { text: 'Logout', style: 'destructive', onPress: () => { Store.clear(); Router.navigate('role'); } }
          ]);
        };

        return () => {
          ordersRef.off('value', onOrders);
          custLocRef.off('value', onCustLoc);
          stopGPS();
          if (map) { map.remove(); window._currentMap = null; }
          delete window.acceptJob;
          delete window.rejectJob;
          delete window.acceptAppointment;
          delete window.rejectAppointment;
          delete window.completeJob;
          delete window.navigateToCustomer;
          delete window.callCustomer;
          delete window.goToTechChat;
          delete window.toggleOnline;
          delete window.techLogout;
        };
      }
    };
  }
});
