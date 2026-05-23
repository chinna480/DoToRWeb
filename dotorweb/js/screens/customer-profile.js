// Customer Profile Screen
Router.register('customer-profile', {
  render() {
    const name = Store.get('custName', 'Customer');
    const phone = Store.get('custPhone', '');
    const email = Store.get('custEmail', '');
    const location = Store.get('custLocation', '');
    const pincode = Store.get('custPincode', '');
    const photo = Store.get('custPhoto', null);
    const rating = 4.8;
    const totalOrders = 0;
    const completedOrders = 0;

    const photoHtml = photo
      ? `<img src="${photo}" class="profile-photo" />`
      : `<div class="profile-photo-placeholder">👤</div>`;

    const MENU = [
      { icon: '❓', label: 'Help & Support', sub: null },
      { icon: '📅', label: 'Schedule', sub: 'Book appointment' },
      { icon: '📋', label: 'My Orders', sub: `${totalOrders} total` },
      { icon: '🛡️', label: 'Safety', sub: null },
      { icon: '🎁', label: 'Refer and Earn', sub: 'Get ₹50' },
      { icon: '🏆', label: 'My Rewards', sub: null },
      { icon: '🎫', label: 'DoToR Pass', sub: null },
      { icon: '🪙', label: 'DoToR Coins', sub: null },
      { icon: '🔔', label: 'Notifications', sub: null, toggle: true },
      { icon: '⚙️', label: 'Settings', sub: null },
      { icon: '📄', label: 'Privacy Policy', sub: null },
      { icon: '📜', label: 'Terms of Service', sub: null },
      { icon: '🚪', label: 'Logout', sub: null, danger: true },
    ];

    const menuHtml = MENU.map((item, i) => `
      <div class="menu-item" onclick="${item.toggle ? 'event.preventDefault()' : item.danger ? 'window.custLogout()' : 'window.custMenuAction(\'' + item.label + '\')'}">
        <div class="menu-left">
          <div class="menu-icon-box ${item.danger ? 'menu-icon-danger' : ''}">
            <span class="menu-icon-emoji">${item.icon}</span>
          </div>
          <div>
            <div class="menu-label ${item.danger ? 'menu-label-danger' : ''}">${item.label}</div>
            ${item.sub ? `<div class="menu-sub-text">${item.sub}</div>` : ''}
          </div>
        </div>
        ${item.toggle
          ? `<button class="toggle on" onclick="event.stopPropagation();this.classList.toggle('on')"><div class="toggle-knob"></div></button>`
          : `<span class="menu-chevron ${item.danger ? 'menu-chevron-danger' : ''}">›</span>`
        }
      </div>
    `).join('');

    return {
      html: `
        <div class="screen">
          <div class="profile-header">
            <button class="header-back" onclick="Router.navigate('home')" style="color:var(--dark)">←</button>
            <span class="header-title" style="color:#111">My Profile</span>
            <div style="width:40px"></div>
          </div>
          <div class="profile-card">
            <div class="profile-row">
              <div class="profile-photo-wrap">
                ${photoHtml}
                <div class="profile-camera-dot" onclick="window.custPickPhoto()">📷</div>
              </div>
              <div class="profile-info">
                <div class="profile-name-text">${name}</div>
                <div class="profile-phone-text">${phone ? '+91 ' + phone : 'Add phone number'}</div>
                ${email ? `<div class="profile-sub-text">${email}</div>` : ''}
                ${location ? `<div class="profile-sub-text">📍 ${location}</div>` : ''}
                ${pincode ? `<div class="profile-sub-text">📮 Pincode: ${pincode}</div>` : ''}
              </div>
            </div>
            <div class="profile-divider"></div>
            <div class="profile-rating-row">
              <span class="profile-star-icon">⭐</span>
              <span class="profile-rating-text">${rating} My Rating</span>
            </div>
          </div>
          <div class="stats-row-profile">
            <div class="stat-card"><div class="stat-number" id="custTotalOrders">${totalOrders}</div><div class="stat-label-small">My Orders</div></div>
            <div class="stat-card"><div class="stat-number" id="custCompleted">${completedOrders}</div><div class="stat-label-small">Completed</div></div>
            <div class="stat-card"><div class="stat-number" id="custPending">${totalOrders - completedOrders}</div><div class="stat-label-small">Pending</div></div>
          </div>
          <div class="menu-card">${menuHtml}</div>
          <div class="version-footer">
            <div class="version-app">🔧 DoToR v1.0.0</div>
            <div class="version-tag">We are the Doctor of your Device</div>
          </div>
          <div style="height:40px"></div>
        </div>
      `,
      init() {
        const myPhone = Store.get('custPhone', '');
        // Load orders for this customer
        if (myPhone) {
          const ordersRef = firebase.database().ref('orders');
          const onOrders = (snap) => {
            if (!snap.exists()) return;
            let total = 0, done = 0;
            snap.forEach(child => {
              const o = child.val();
              if (o.customerPhone === myPhone) {
                total++;
                if (o.status === 'completed') done++;
              }
            });
            document.getElementById('custTotalOrders').textContent = total;
            document.getElementById('custCompleted').textContent = done;
            document.getElementById('custPending').textContent = total - done;
          };
          ordersRef.on('value', onOrders);
          window._custOrdersCleanup = () => ordersRef.off('value', onOrders);
        }

        window.custPickPhoto = () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = (e) => {
            if (e.target.files.length) {
              const reader = new FileReader();
              reader.onload = (ev) => Store.set('custPhoto', ev.target.result);
              reader.readAsDataURL(e.target.files[0]);
              showAlert('Photo', 'Photo will be saved on next login.');
            }
          };
          input.click();
        };

        window.custMenuAction = (label) => {
          const actions = {
            'Help & Support': () => showAlert('Help', 'Email: support@dotor.in'),
            'Schedule': () => Router.navigate('schedule'),
            'My Orders': () => showAlert('Orders', `Check your orders on the home screen.`),
            'Safety': () => showAlert('Safety', 'Your safety is our priority!'),
            'Refer and Earn': () => showAlert('Refer', 'Share DoToR and earn ₹50!'),
            'My Rewards': () => showAlert('Rewards', 'Coming Soon!'),
            'DoToR Pass': () => showAlert('Pass', 'Coming Soon!'),
            'DoToR Coins': () => showAlert('Coins', 'Coming Soon!'),
            'Settings': () => showAlert('Settings', 'Coming Soon!'),
            'Privacy Policy': () => showAlert('Privacy', 'Your data is secure!'),
            'Terms of Service': () => showAlert('Terms', 'Use DoToR responsibly!'),
          };
          if (actions[label]) actions[label]();
        };

        window.custLogout = () => {
          showAlert('Logout?', 'Are you sure you want to logout?', [
            { text: 'Cancel' },
            { text: 'Logout', style: 'destructive', onPress: () => { Store.clear(); Router.navigate('role'); } }
          ]);
        };

        return () => {
          if (window._custOrdersCleanup) { window._custOrdersCleanup(); delete window._custOrdersCleanup; }
          delete window.custPickPhoto;
          delete window.custMenuAction;
          delete window.custLogout;
        };
      }
    };
  }
});
