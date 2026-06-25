// Home Screen - Customer booking
const PHONE_BRANDS = ['iPhone', 'Samsung', 'OnePlus', 'Redmi', 'Vivo', 'Oppo', 'Realme', 'Nokia'];
const LAPTOP_BRANDS = ['Dell', 'HP', 'Lenovo', 'MacBook', 'Asus', 'Acer', 'MSI', 'Sony'];
const PHONE_REPAIRS = ['Screen Replacement', 'Battery Replacement', 'Charging Port', 'Speaker Issue', 'Camera Repair', 'Water Damage', 'Back Panel', 'Software Issue'];
const LAPTOP_REPAIRS = ['Screen Replacement', 'Battery Replacement', 'Keyboard Repair', 'Charging Port', 'RAM Upgrade', 'Hard Disk', 'Overheating', 'Software Issue'];
const WHY_DOTOR = [
  { icon: '🏠', title: 'Doorstep Service', desc: 'Technician comes to your home!' },
  { icon: '👀', title: 'Repair in Front of You', desc: '100% transparent process!' },
  { icon: '⚡', title: 'Fast Service', desc: 'Arrives within 60 mins!' },
  { icon: '🛡️', title: '30 Day Warranty', desc: 'All repairs covered!' },
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
        <div class="screen">
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
          <div class="search-bar">
            <span style="font-size:16px">🔍</span>
            <input class="form-input" placeholder="Search repair service..." />
          </div>
          <div class="banner" onclick="Router.navigate('schedule')">
            <div>
              <div class="banner-text">🔧 Expert Repair at Your Doorstep!</div>
              <div class="banner-sub">Book in 30 seconds!</div>
            </div>
            <div class="banner-cta"><span class="banner-cta-text">📅 Schedule</span></div>
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
          <div id="repairSection" style="display:none">
            <div class="section-title">Step 3 — What needs Repair?</div>
            <div id="repairList"></div>
          </div>
          <div class="section-title">⭐ Why DoToR?</div>
          ${whyHtml}
          <div style="height:40px"></div>
        </div>
      `,
      init() {
        let selectedDevice = null;
        let selectedBrand = null;

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
          document.getElementById('repairSection').style.display = 'none';
        };

        window.selectBrand = (brand) => {
          selectedBrand = brand;
          document.querySelectorAll('.brand-card').forEach(c => c.classList.remove('active'));
          document.querySelector(`.brand-card[data-brand="${brand}"]`).classList.add('active');
          const repairs = selectedDevice === 'phone' ? PHONE_REPAIRS : LAPTOP_REPAIRS;
          const repairList = document.getElementById('repairList');
          repairList.innerHTML = repairs.map(r => `
            <div class="repair-item" onclick="window.bookRepair('${r}')">
              <span class="repair-text">🔧 ${r}</span>
              <span class="repair-arrow">→</span>
            </div>
          `).join('');
          document.getElementById('repairSection').style.display = 'block';
        };

        window.bookRepair = async (repair) => {
          const name = Store.get('custName', 'Customer');
          const loc = Store.get('custLocation', 'Your Location');
          const phone = Store.get('custPhone', '');
          const pushToken = Store.get('pushToken', '');
          const pincode = Store.get('custPincode', '');
          Store.set('lastBrand', selectedBrand);
          Store.set('lastRepair', repair);

          // Get GPS position
          const pos = await getCurrentPositionOnce();
          try { firebase.database().ref('custLocation').set({ lat: pos.lat, lng: pos.lng }); } catch (e) {}

          const order = {
            customerName: name,
            customerPhone: phone,
            customerPushToken: pushToken,
            location: loc,
            pincode: pincode,
            brand: selectedBrand,
            repair: repair,
            status: 'pending',
            time: new Date().toLocaleTimeString()
          };
          try {
            const newRef = firebase.database().ref('orders').push(order);
            const orderId = newRef.key;
            Store.set('lastOrderId', orderId);
            showAlert('✅ Booking Confirmed!', `Brand: ${selectedBrand}\nRepair: ${repair}\n\nTrack your technician?`, [
              { text: 'Track Now', onPress: () => Router.navigate('tracking') },
              { text: '💬 Chat', onPress: () => Router.navigate('chat', { orderId, role: 'cust', customerName: name }) },
              { text: '💰 Pay', onPress: () => Router.navigate('payment') },
              { text: 'Later' }
            ]);
          } catch (e) { showAlert('Error', 'Booking failed! Try again.'); }
        };

        return () => { delete window.selectDevice; delete window.selectBrand; delete window.bookRepair; };
      }
    };
  }
});
