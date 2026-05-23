// Tech Profile Screen
Router.register('tech-profile', {
  render() {
    const name = Store.get('techName', 'Technician');
    const phone = Store.get('techPhone', '');
    const location = Store.get('techLocation', '');
    const pincode = Store.get('techPincode', '');
    const exp = Store.get('techExp', '');
    const photo = Store.get('techPhoto', null);
    const rating = 4.8;
    const totalJobs = 0;
    const totalEarning = 0;

    const photoHtml = photo
      ? `<img src="${photo}" class="tech-profile-photo" />`
      : `<div class="tech-profile-photo-placeholder">👨‍🔧</div>`;

    const MENU = [
      { icon: '💰', label: 'My Earnings', sub: `₹${totalEarning} Total` },
      { icon: '📋', label: 'Job History', sub: `${totalJobs} jobs done` },
      { icon: '⭐', label: 'My Rating', sub: `${rating} stars` },
      { icon: '🎁', label: 'Refer and Earn', sub: 'Get ₹100 per referral' },
      { icon: '🏆', label: 'My Rewards', sub: null },
      { icon: '💳', label: 'Payment Info', sub: 'Bank & UPI details' },
      { icon: '📊', label: 'Performance', sub: 'View your stats' },
      { icon: '🔔', label: 'Notifications', sub: null, toggle: true },
      { icon: '🛡️', label: 'Safety', sub: null },
      { icon: '❓', label: 'Help & Support', sub: null },
      { icon: '📄', label: 'Privacy Policy', sub: null },
      { icon: '🚪', label: 'Logout', sub: null, danger: true },
    ];

    const menuHtml = MENU.map((item) => `
      <div class="menu-item" onclick="${item.toggle ? 'event.preventDefault()' : item.danger ? 'window.techProfLogout()' : 'window.techProfAction(\'' + item.label + '\')'}">
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
            <button class="header-back" onclick="Router.navigate('tech-home')" style="color:var(--dark)">←</button>
            <span class="header-title" style="color:#111">My Profile</span>
            <div style="width:40px"></div>
          </div>
          <div class="tech-profile-card">
            <div class="profile-photo-wrap" onclick="window.techPickPhoto()">
              ${photoHtml}
              <div class="profile-camera-dot">📷</div>
            </div>
            <div class="tech-profile-name">${name}</div>
            <div class="tech-profile-detail">📱 +91 ${phone || 'Add phone'}</div>
            <div class="tech-profile-detail">📍 ${location || 'Add location'}</div>
            ${pincode ? `<div class="tech-profile-detail">📮 Pincode: ${pincode}</div>` : ''}
            <div class="tech-profile-detail">⭐ ${exp || 'Experience not set'}</div>
            <div class="tech-online-row">
              <span class="tech-online-label">Status:</span>
              <button class="toggle on" id="techProfToggle" onclick="this.classList.toggle('on');document.getElementById('techProfStatus').textContent=this.classList.contains('on')?'🟢 Online':'🔴 Offline'"><div class="toggle-knob"></div></button>
              <span class="tech-online-status" id="techProfStatus">🟢 Online</span>
            </div>
            <div class="tech-rating-row">
              <span style="font-size:22px">⭐</span>
              <span style="font-size:16px;font-weight:800;color:var(--primary)">${rating} Rating</span>
              <span style="font-size:12px;color:var(--gray);font-weight:600">(${totalJobs} jobs)</span>
            </div>
          </div>
          <div class="section-title">💰 My Earnings</div>
          <div class="tech-earnings-row">
            <div class="earn-card-colored" style="background:var(--primary)"><div class="earn-card-label">Today</div><div class="earn-card-value" id="techEarnToday">₹0</div></div>
            <div class="earn-card-colored" style="background:var(--dark)"><div class="earn-card-label">This Week</div><div class="earn-card-value" id="techEarnWeek">₹0</div></div>
            <div class="earn-card-colored" style="background:var(--success)"><div class="earn-card-label">Total</div><div class="earn-card-value" id="techEarnTotal">₹0</div></div>
          </div>
          <div class="section-title">📊 My Stats</div>
          <div class="tech-stats-row">
            <div class="stat-card"><div class="stat-number" id="techStatsJobs">0</div><div class="stat-label-small">Total Jobs</div></div>
            <div class="stat-card"><div class="stat-number">${rating}</div><div class="stat-label-small">Rating</div></div>
            <div class="stat-card"><div class="stat-number">100%</div><div class="stat-label-small">Acceptance</div></div>
          </div>
          <div id="techRecentJobs"></div>
          <div class="section-title">⚙️ More Options</div>
          <div class="menu-card">${menuHtml}</div>
          <div class="version-footer">
            <div class="version-app">🔧 DoToR v1.0.0</div>
            <div class="version-tag">We are the Doctor of your Device</div>
          </div>
          <div style="height:40px"></div>
        </div>
      `,
      init() {
        const myPhone = Store.get('techPhone', '');
        let totalJobsNum = 0, totalEarningNum = 0;

        // Load jobs for this tech
        if (myPhone) {
          const ordersRef = firebase.database().ref('orders');
          const onOrders = (snap) => {
            if (!snap.exists()) return;
            let total = 0, earning = 0, jobs = [];
            snap.forEach(child => {
              const o = child.val();
              if (o.techPhone === myPhone && o.status === 'completed') {
                total++;
                earning += 299;
                jobs.push({ id: child.key, ...o });
              }
            });
            totalJobsNum = total;
            totalEarningNum = earning;
            document.getElementById('techEarnToday').textContent = '₹' + (total > 0 ? 299 : 0);
            document.getElementById('techEarnWeek').textContent = '₹' + (total * 250);
            document.getElementById('techEarnTotal').textContent = '₹' + earning;
            document.getElementById('techStatsJobs').textContent = total;

            if (jobs.length > 0) {
              const recentJobs = jobs.reverse().slice(0, 10);
              document.getElementById('techRecentJobs').innerHTML = `
                <div class="section-title">✅ Recent Jobs</div>
                ${recentJobs.map(j => `
                  <div class="completed-card">
                    <div class="comp-left">
                      <div class="comp-customer">👤 ${j.customerName}</div>
                      <div class="comp-type">📱 ${j.brand} — ${j.repair}</div>
                      <div class="comp-time-small">📍 ${j.location}</div>
                      <div class="comp-time-small">🕐 ${j.time}</div>
                    </div>
                    <div class="comp-right">
                      <div class="comp-done">₹299</div>
                      <div style="background:#e8f5e9;padding:3px 8px;border-radius:10px;margin-top:4px">
                        <span style="font-size:11px;font-weight:800;color:var(--success)">✅ Done</span>
                      </div>
                    </div>
                  </div>
                `).join('')}
              `;
            }
          };
          ordersRef.on('value', onOrders);
          window._techProfCleanup = () => ordersRef.off('value', onOrders);
        }

        window.techPickPhoto = () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = (e) => {
            if (e.target.files.length) {
              const reader = new FileReader();
              reader.onload = (ev) => Store.set('techPhoto', ev.target.result);
              reader.readAsDataURL(e.target.files[0]);
              showAlert('Photo', 'Photo will be saved on next login.');
            }
          };
          input.click();
        };

        window.techProfAction = (label) => {
          const actions = {
            'My Earnings': () => showAlert('Earnings', `Total: ₹${totalEarningNum}\nToday: ₹${totalJobsNum > 0 ? 299 : 0}\nThis Week: ₹${totalJobsNum * 250}`),
            'Job History': () => showAlert('Jobs', `${totalJobsNum} jobs completed`),
            'My Rating': () => showAlert('Rating', `Your rating: ${rating} ⭐`),
            'Refer and Earn': () => showAlert('Refer', 'Share DoToR and earn ₹100!'),
            'My Rewards': () => showAlert('Rewards', 'Coming Soon!'),
            'Payment Info': () => showAlert('Payment', 'Add your UPI ID to receive payments directly!'),
            'Performance': () => showAlert('Stats', `Jobs: ${totalJobsNum}\nRating: ${rating}`),
            'Safety': () => showAlert('Safety', 'Your safety matters!'),
            'Help & Support': () => showAlert('Help', 'support@dotor.in'),
            'Privacy Policy': () => showAlert('Privacy', 'Your data is secure!'),
          };
          if (actions[label]) actions[label]();
        };

        window.techProfLogout = () => {
          showAlert('Logout?', 'Are you sure you want to logout?', [
            { text: 'Cancel' },
            { text: 'Logout', style: 'destructive', onPress: () => { Store.clear(); Router.navigate('role'); } }
          ]);
        };

        return () => {
          if (window._techProfCleanup) { window._techProfCleanup(); delete window._techProfCleanup; }
          delete window.techPickPhoto;
          delete window.techProfAction;
          delete window.techProfLogout;
        };
      }
    };
  }
});
