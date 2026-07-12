// Orders Screen - View previous orders with Day / Week / Month filters
Router.register('orders', {
  render() {
    return {
      html: `
        <div class="screen">
          <!-- Header -->
          <div class="header header-dark">
            <span class="header-title">📋 My Orders</span>
            <div style="width:40px"></div>
          </div>

          <!-- Filter Tabs -->
          <div style="display:flex;gap:8px;padding:15px 15px 5px;overflow-x:auto">
            <button class="order-filter-btn active" data-filter="day" onclick="window.setOrderFilter('day')">📅 Today</button>
            <button class="order-filter-btn" data-filter="week" onclick="window.setOrderFilter('week')">📆 This Week</button>
            <button class="order-filter-btn" data-filter="month" onclick="window.setOrderFilter('month')">🗓️ This Month</button>
            <button class="order-filter-btn" data-filter="all" onclick="window.setOrderFilter('all')">📋 All</button>
          </div>

          <!-- Orders List -->
          <div id="ordersList" style="padding:10px 15px">
            <div class="empty-card">
              <div style="font-size:40px;margin-bottom:10px">📦</div>
              <div class="empty-text">Loading orders...</div>
            </div>
          </div>

          <div style="height:40px"></div>
        </div>
      `,
      init() {
        let currentFilter = 'day';
        let allOrders = [];
        let ordersRef = null;
        let onOrdersCallback = null;

        // Load orders from Firebase
        const myPhone = Store.get('custPhone', '');
        if (!myPhone) {
          document.getElementById('ordersList').innerHTML = `
            <div class="empty-card">
              <div style="font-size:40px;margin-bottom:10px">📱</div>
              <div class="empty-text">Please login to view your orders</div>
            </div>
          `;
          return () => {};
        }

        function renderOrders(filter) {
          const container = document.getElementById('ordersList');
          if (!container) return;

          const now = new Date();
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

          let filtered = allOrders.filter(o => {
            const orderTime = o.createdAt ? new Date(o.createdAt) : null;
            if (!orderTime) return false;
            switch (filter) {
              case 'day': return orderTime >= startOfDay;
              case 'week': return orderTime >= startOfWeek;
              case 'month': return orderTime >= startOfMonth;
              default: return true;
            }
          });

          // Sort by newest first
          filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

          if (!filtered.length) {
            container.innerHTML = `
              <div class="empty-card">
                <div style="font-size:40px;margin-bottom:10px">📭</div>
                <div class="empty-text">No orders found for this period</div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:6px;font-weight:600">Book a repair to get started!</div>
              </div>
            `;
            return;
          }

          container.innerHTML = filtered.map((order, idx) => {
            const svcIcon = order.service && order.service.includes('Mobile') ? '📱'
              : order.service && order.service.includes('Laptop') ? '💻'
              : order.service && order.service.includes('TV') ? '📺'
              : order.service && order.service.includes('AC') ? '❄️'
              : order.service && order.service.includes('Refrigerator') ? '🧊'
              : order.service && order.service.includes('Washing') ? '🧺'
              : order.service && order.service.includes('Electric') ? '🔌'
              : order.service && order.service.includes('Plumb') ? '🚰'
              : order.service && order.service.includes('CCTV') ? '📡'
              : order.service && order.service.includes('Wi-Fi') ? '🌐'
              : order.service && order.service.includes('RO') ? '💧'
              : order.service && order.service.includes('Inverter') ? '🔋'
              : '🛠️';

            const statusColor = order.status === 'completed' ? 'var(--success)'
              : order.status === 'pending' ? (order.scheduleMode === 'later' ? '#7B2FF7' : 'var(--primary)')
              : order.status === 'accepted' || order.status === 'assigned' ? 'var(--dark)'
              : 'var(--text-secondary)';

            const statusLabel = order.status === 'completed' ? '✅ Done'
              : order.status === 'pending' ? (order.scheduleMode === 'later' ? '📅 Scheduled' : '⏳ Pending')
              : order.status === 'accepted' ? '🔧 In Progress'
              : order.status === 'assigned' ? '🛵 Assigned'
              : '❓ Unknown';

            const orderDate = order.createdAt
              ? formatDate(order.createdAt) + ' • ' + formatTime(order.createdAt)
              : '—';

            // For scheduled orders, show the scheduled date/time instead
            let scheduleInfo = '';
            if (order.scheduleMode === 'later' && order.scheduleDateLabel && order.scheduleSlot) {
              scheduleInfo = `
                <div style="display:flex;align-items:center;gap:6px;margin-top:4px;padding:6px 10px;background:#f3e8ff;border-radius:8px;font-size:12px;font-weight:700;color:#7B2FF7;width:fit-content">
                  <span>📅</span>
                  <span>${order.scheduleDateLabel} • 🕐 ${order.scheduleSlot}</span>
                </div>
              `;
            }

            const orderId = order._key ? order._key.slice(-5).toUpperCase() : ('#' + (idx + 1));

            const cardClass = order.status === 'completed' ? 'completed'
              : order.status === 'pending' ? (order.scheduleMode === 'later' ? 'scheduled' : 'pending')
              : 'ongoing';

            // Generate photo thumbnails if order has photos
            let photoThumbsHtml = '';
            if (order.photos && order.photos.length > 0) {
              const MAX_VISIBLE = 3;
              const visible = order.photos.slice(0, MAX_VISIBLE);
              const remaining = order.photos.length - MAX_VISIBLE;
              photoThumbsHtml = `
                <div class="order-photo-strip" style="position:relative;z-index:1">
                  ${visible.map(url => `
                    <div class="order-photo-thumb" onclick="event.stopPropagation();Router.navigate('tracking')">
                      <img src="${url}" alt="Order photo" loading="lazy" />
                    </div>
                  `).join('')}
                  ${remaining > 0 ? `<div class="order-photo-more" onclick="event.stopPropagation();Router.navigate('tracking')">+${remaining}</div>` : ''}
                </div>
              `;
            }

            return `
              <div class="job-card ${cardClass}" onclick="Router.navigate('tracking')" style="cursor:pointer">
                <div style="display:flex;align-items:center;gap:12px;position:relative;z-index:1">
                  <div style="font-size:32px">${order.scheduleMode === 'later' ? '📅' : svcIcon}</div>
                  <div style="flex:1;min-width:0">
                    <div class="job-customer">${order.service || 'Repair Service'}${order.brand ? ' • ' + order.brand : ''}</div>
                    <div class="job-type">${order.repair || order.issue || 'General Service'}</div>
                    ${scheduleInfo}
                    <div class="job-time">🕐 ${orderDate}</div>
                  </div>
                  <div style="text-align:right;flex-shrink:0">
                    <div style="font-size:11px;font-weight:800;color:${statusColor}">${statusLabel}</div>
                    <div style="font-size:10px;color:var(--text-secondary);margin-top:3px;font-weight:600">#DR${orderId}</div>
                  </div>
                </div>
                ${photoThumbsHtml}
              </div>
            `;
          }).join('');
        }

        // Track previous statuses for notification on change
        let prevOrderStatuses = {};

        // Set up filter switching
        window.setOrderFilter = (filter) => {
          currentFilter = filter;
          document.querySelectorAll('.order-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
          });
          renderOrders(filter);
        };

        // Listen for orders
        ordersRef = firebase.database().ref('orders');
        onOrdersCallback = (snap) => {
          if (!snap.exists()) {
            allOrders = [];
            renderOrders(currentFilter);
            return;
          }
          allOrders = [];
          snap.forEach(child => {
            const order = child.val();
            if (order.customerPhone === myPhone) {
              order._key = child.key;
              allOrders.push(order);

              // Detect status changes and notify customer
              const key = child.key;
              const prev = prevOrderStatuses[key];
              const curr = order.status;
              if (prev && prev !== curr) {
                const notifData = { screen: 'tracking', orderId: key };
                if (curr === 'assigned') {
                  const techName = order.techName || 'a technician';
                  PushNotifications.writeToCustomer(
                    myPhone,
                    '🛵 Technician Assigned',
                    `${techName} has been assigned to your ${order.service || 'repair'}`,
                    'assigned',
                    notifData
                  );
                } else if (curr === 'accepted') {
                  PushNotifications.writeToCustomer(
                    myPhone,
                    '🔧 Repair In Progress',
                    `Your ${order.service || 'repair'} is now being worked on`,
                    'in_progress',
                    notifData
                  );
                } else if (curr === 'completed') {
                  PushNotifications.writeToCustomer(
                    myPhone,
                    '✅ Repair Completed!',
                    `Your ${order.service || 'repair'} is done. Please rate your experience!`,
                    'completed',
                    { screen: 'review', orderId: key }
                  );
                }
              }
              prevOrderStatuses[key] = curr;
            }
          });
          renderOrders(currentFilter);
        };
        ordersRef.on('value', onOrdersCallback);

        return () => {
          if (ordersRef && onOrdersCallback) ordersRef.off('value', onOrdersCallback);
          delete window.setOrderFilter;
        };
      }
    };
  }
});
