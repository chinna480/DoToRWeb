// Notifications Screen - Bento Glass with real Firebase data
Router.register('notifications', {
  render() {
    return {
      html: `
        <div class="screen">
          <div class="header header-dark">
            <button class="header-back" onclick="Router.navigate('home')">←</button>
            <span class="header-title" style="flex:1;text-align:center">🔔 Notifications</span>
            <button class="header-icon-btn" onclick="window.markAllNotifRead()" title="Mark all as read" id="markAllReadBtn" style="display:none">✓✓</button>
          </div>
          <div id="notifList" class="scroll-content">
            <div class="glass" style="margin-top:60px;padding:30px 20px;text-align:center">
              <div style="font-size:50px;margin-bottom:15px">🔔</div>
              <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px">Loading notifications...</div>
            </div>
          </div>
          <div style="height:40px"></div>
        </div>
      `,
      init() {
        const myPhone = Store.get('custPhone', '');
        let notifRef = null;
        let onNotifs = null;

        if (!myPhone) {
          document.getElementById('notifList').innerHTML = `
            <div class="glass" style="margin-top:60px;padding:30px 20px;text-align:center">
              <div style="font-size:50px;margin-bottom:15px">🔔</div>
              <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px">Please login to see notifications</div>
            </div>
          `;
          return () => {};
        }

        function renderNotifs(snap) {
          const container = document.getElementById('notifList');
          const markBtn = document.getElementById('markAllReadBtn');
          if (!container) return;

          if (!snap || !snap.exists()) {
            container.innerHTML = `
              <div class="glass" style="margin-top:60px;padding:30px 20px;text-align:center">
                <div style="font-size:50px;margin-bottom:15px">🔔</div>
                <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px">No Notifications Yet</div>
                <div style="font-size:13px;color:var(--text-secondary);line-height:22px;font-weight:600">
                  You'll see order updates,<br>promotions, and other alerts here. ✨
                </div>
              </div>
            `;
            if (markBtn) markBtn.style.display = 'none';
            return;
          }

          const notifs = [];
          snap.forEach(child => notifs.push({ _key: child.key, ...child.val() }));

          // Sort newest first
          notifs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

          const hasUnread = notifs.some(n => !n.read);
          if (markBtn) markBtn.style.display = hasUnread ? 'inline-flex' : 'none';

          const TYPE_ICONS = {
            'order': '📦',
            'new_order': '🆕',
            'assigned': '🛵',
            'in_progress': '🔧',
            'completed': '✅',
            'message': '💬',
            'promo': '🎉',
          };

          container.innerHTML = notifs.map(n => {
            const icon = TYPE_ICONS[n.type] || '🔔';
            const timeAgo = getTimeAgo(n.createdAt);
            return `
              <div class="notif-item ${n.read ? '' : 'notif-unread'}" data-key="${n._key}" onclick="window.notifClick('${n._key}')">
                <div class="notif-icon-wrap ${n.read ? '' : 'notif-icon-unread'}">
                  <span class="notif-icon">${icon}</span>
                </div>
                <div class="notif-content">
                  <div class="notif-title">${n.title}</div>
                  ${n.body ? `<div class="notif-body">${n.body}</div>` : ''}
                  <div class="notif-time">${timeAgo}</div>
                </div>
                ${!n.read ? '<div class="notif-dot"></div>' : ''}
              </div>
            `;
          }).join('');
        }

        // Listen for notifications
        notifRef = firebase.database().ref('notifications/' + myPhone);
        onNotifs = (snap) => renderNotifs(snap);
        notifRef.on('value', onNotifs);

        // Click handler
        window.notifClick = (key) => {
          // Mark as read
          PushNotifications.markAsRead(myPhone, key);

          // Navigate based on notification type
          const el = document.querySelector(`.notif-item[data-key="${key}"]`);
          if (el) {
            const idx = Array.from(el.parentNode.children).indexOf(el);
            // We can't easily get the data from DOM, so fetch from Firebase
            firebase.database().ref('notifications/' + myPhone + '/' + key).once('value').then(snap => {
              if (!snap.exists()) return;
              const n = snap.val();
              const screen = n.data?.screen || n.type === 'message' ? 'chat' : 'tracking';
              const params = {};
              if (screen === 'chat' && n.data?.orderId) params.orderId = n.data.orderId;
              Router.navigate(screen, params);
            });
          }
        };

        // Mark all as read
        window.markAllNotifRead = () => {
          PushNotifications.markAllAsRead(myPhone);
        };

        return () => {
          if (notifRef && onNotifs) notifRef.off('value', onNotifs);
          delete window.notifClick;
          delete window.markAllNotifRead;
        };
      }
    };
  }
});

// Helper: Relative time
function getTimeAgo(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + 'd ago';
  return new Date(timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
