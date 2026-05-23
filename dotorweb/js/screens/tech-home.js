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
        let map = null, custMarker = null, myMarker = null, polyline = null;
        let techPushToken = Store.get('pushToken', '');
        let dailyCompletedCount = 0;
        let areaAssignments = {};
        let pendingOrdersMap = {};
        const myPhone = Store.get('techPhone', '');
        const SPEED = 0.3; // km/min (~18 km/h — realistic city speed)

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
          el.innerHTML = pending.map(o => `
            <div class="job-card pending">
              <div class="job-new-badge">NEW</div>
              <div class="job-customer">👤 ${o.customerName}</div>
              <div class="job-type">📱 ${o.brand} — ${o.repair}</div>
              <div class="job-location">📍 ${o.location}</div>
              ${o.pincode ? `<div class="job-location">📮 ${o.pincode}</div>` : ''}
              <div class="job-time">🕐 ${o.time}</div>
              <div class="job-actions">
                ${ongoingOrder
                  ? '<div style="width:100%;background:#fff3e0;padding:10px;border-radius:10px;text-align:center;font-size:12px;font-weight:700;color:#e65100">⚠️ Complete current job first</div>'
                  : `
                    <button class="btn btn-sm btn-danger" onclick="window.rejectJob('${o.id}')" style="flex:1">✕ Reject</button>
                    <button class="btn btn-sm btn-dark" onclick="window.acceptJob('${o.id}')" style="flex:1">✓ Accept</button>
                  `
                }
              </div>
              ${o.id ? `<button class="btn btn-primary btn-sm btn-block" onclick="window.goToChatFromPending('${o.id}','${o.customerName || 'Customer'}')" style="margin-top:8px">💬 Chat with Customer</button>` : ''}
            </div>
          `).join('');
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

        // Listen for orders
        const ordersRef = firebase.database().ref('orders');
        const onOrders = (snap) => {
          const pending = [], completed = [];
          let ongoing = null, count = 0;
          dailyCompletedCount = 0;

          snap.forEach(child => {
            const order = { id: child.key, ...child.val() };
            if (order.status === 'pending') pending.push(order);
            if (order.status === 'accepted') {
              // Only mark as ongoing if THIS tech accepted the job
              if (order.techPhone === myPhone) ongoing = order;
            }
            if (order.status === 'completed') { completed.push(order); count++; dailyCompletedCount++; }
          });

          // Filter pending jobs by technician's location area AND pincode
          const techLoc     = Store.get('techLocation', '').toLowerCase().trim();
          const techPincode = Store.get('techPincode', '').toLowerCase().trim();
          let filteredPending = pending;
          if (techLoc) {
            filteredPending = filteredPending.filter(o => (o.location || '').toLowerCase().trim() === techLoc);
          }
          if (techPincode) {
            filteredPending = filteredPending.filter(o => (o.pincode || '').toLowerCase().trim() === techPincode);
          }

          // If an area is already assigned to a different technician, exclude those jobs
          // so only the assigned technician sees them
          filteredPending = filteredPending.filter(o => {
            const area = (o.location || '').toLowerCase().trim();
            const assignedTech = areaAssignments[area];
            if (!area || !assignedTech) return true; // No assignment → anyone can take it
            // If assigned to this tech → show it
            return assignedTech.phone === myPhone;
          });

          prevPendingIds = new Set(filteredPending.map(o => o.id));

          pending.length = 0;
          pending.push(...filteredPending);

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
