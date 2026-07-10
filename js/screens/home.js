// Home Screen - Customer booking with full service categories
const PHONE_BRANDS = ['iPhone', 'Samsung', 'OnePlus', 'Redmi', 'Vivo', 'Oppo', 'Realme', 'Nokia'];
const LAPTOP_BRANDS = ['Dell', 'HP', 'Lenovo', 'MacBook', 'Asus', 'Acer', 'MSI', 'Sony'];
const TV_BRANDS = ['Samsung', 'LG', 'Sony', 'Panasonic', 'TCL', 'Mi', 'OnePlus', 'Realme'];
const AC_BRANDS = ['LG', 'Samsung', 'Daikin', 'Voltas', 'Blue Star', 'Hitachi', 'Panasonic', 'Mitsubishi'];
const FRIDGE_BRANDS = ['Samsung', 'LG', 'Whirlpool', 'Godrej', 'Bosch', 'Panasonic', 'Haier', 'Voltas Beko'];
const WASHING_BRANDS = ['LG', 'Samsung', 'Whirlpool', 'Bosch', 'IFB', 'Haier', 'TCL', 'Sansui'];
const PHONE_REPAIRS = ['Screen Replacement', 'Battery Replacement', 'Charging Port', 'Speaker Issue', 'Camera Repair', 'Water Damage', 'Back Panel', 'Software Issue'];
const LAPTOP_REPAIRS = ['Screen Replacement', 'Battery Replacement', 'Keyboard Repair', 'Charging Port', 'RAM Upgrade', 'Hard Disk', 'Overheating', 'Software Issue'];
const TV_REPAIRS = ['Display/Screen Issue', 'No Power', 'Sound Problem', 'HDMI/Port Issue', 'Smart TV Software', 'Backlight Issue'];
const AC_REPAIRS = ['Gas Refill', 'Not Cooling', 'Water Leakage', 'Compressor Issue', 'Remote Not Working', 'Service & Cleaning'];
const FRIDGE_REPAIRS = ['Not Cooling', 'Gas Leak', 'Compressor Issue', 'Water Leakage', 'Ice Maker Issue', 'Thermostat Problem'];
const WASHING_REPAIRS = ['Drum Issue', 'Not Spinning', 'Water Drainage', 'Leakage', 'Motor Problem', 'Service & Maintenance'];
const CARPENTER_REPAIRS = ['Furniture Assembly', 'Door Repair', 'Cabinet Installation', 'Shelf Installation', 'Wood Polish', 'Furniture Repair', 'Lock Replacement', 'Custom Carpentry'];
const PAINTER_REPAIRS = ['Wall Painting', 'Texture Finish', 'Waterproofing', 'Furniture Painting', 'Wallpaper Installation', 'Ceiling Paint', 'Exterior Paint', 'Touch-up Work'];
const CLEANING_REPAIRS = ['Full Home Cleaning', 'Bathroom Cleaning', 'Kitchen Cleaning', 'Sofa Cleaning', 'Carpet Cleaning', 'Window Cleaning', 'Tank Cleaning', 'Deep Cleaning'];

const SERVICES = [
  { id: 'mobile',   icon: '📱',    name: 'Mobile Repair',          brands: PHONE_BRANDS,   repairs: PHONE_REPAIRS },
  { id: 'laptop',   icon: '💻',    name: 'Laptop & PC Repair',     brands: LAPTOP_BRANDS,  repairs: LAPTOP_REPAIRS },
  { id: 'tv',       icon: '📺',    name: 'TV Repair',              brands: TV_BRANDS,      repairs: TV_REPAIRS },
  { id: 'ac',       icon: '❄️',    name: 'AC Service & Repair',    brands: AC_BRANDS,      repairs: AC_REPAIRS },
  { id: 'fridge',   icon: '🧊',    name: 'Refrigerator Repair',    brands: FRIDGE_BRANDS,  repairs: FRIDGE_REPAIRS },
  { id: 'washing',  icon: '🧺',    name: 'Washing Machine Repair',  brands: WASHING_BRANDS, repairs: WASHING_REPAIRS },
  { id: 'electric', icon: '🔌',    name: 'Electrician Services',    brands: [],             repairs: [] },
  { id: 'plumbing', icon: '🚰',    name: 'Plumbing Services',       brands: [],             repairs: [] },
  { id: 'carpenter',icon: '🪚',    name: 'Carpenter Services',     brands: [],             repairs: CARPENTER_REPAIRS },
  { id: 'painter',  icon: '🎨',    name: 'Painter Services',       brands: [],             repairs: PAINTER_REPAIRS },
  { id: 'cleaning', icon: '🧹',    name: 'Cleaning Services',      brands: [],             repairs: CLEANING_REPAIRS },
  { id: 'cctv',     icon: '📡',    name: 'CCTV Installation',      brands: [],             repairs: [] },
  { id: 'wifi',     icon: '🌐',    name: 'Wi-Fi Router Setup',     brands: [],             repairs: [] },
  { id: 'ro',       icon: '💧',    name: 'RO Water Purifier Service', brands: [],          repairs: [] },
  { id: 'inverter', icon: '🔋',    name: 'Inverter & UPS Service',  brands: [],            repairs: [] },
];

// Bento glass service categories (8 tiles shown on home screen)
const BENTO_SERVICES = [
  { id: 'electric',  icon: '🔌', name: 'Electrician',    tint: 'yellow' },
  { id: 'plumbing',  icon: '🚰', name: 'Plumber',        tint: 'blue' },
  { id: 'mobile',    icon: '📱', name: 'Device Repair',  tint: 'purple' },
  { id: 'ac',        icon: '❄️', name: 'AC Service',     tint: 'teal' },
  { id: 'carpenter', icon: '🪚', name: 'Carpenter',      tint: 'orange' },
  { id: 'painter',   icon: '🎨', name: 'Painter',        tint: 'pink' },
  { id: 'cleaning',  icon: '🧹', name: 'Cleaning',       tint: 'green' },
  { id: 'more',      icon: '➕', name: 'More',           tint: 'red' },
];

const WHY_DOTOR = [
  { icon: '🏠', title: 'Doorstep Service', desc: 'Technician comes to your home!' },
  { icon: '👀', title: 'Repair in Front of You', desc: '100% transparent process!' },
  { icon: '⚡', title: 'Fast Service', desc: 'Arrives within 60 mins!' },
  { icon: '🛡️', title: '30 Day Warranty', desc: 'All repairs covered!' },
  { icon: '💰', title: 'Best Price', desc: 'No hidden charges ever!' },
];

// All services HTML (for the full list shown after "More" or when a bento tile is matched)
function allServicesHtml() {
  return SERVICES.map(s => `
    <div class="service-card" data-service="${s.id}" onclick="window.selectService('${s.id}')">
      <span class="service-card-icon">${s.icon}</span>
      <div class="service-card-name">${s.name}</div>
      ${s.brands.length ? '<div class="service-card-sub">Brand/Model</div>' : '<div class="service-card-sub">Book Now</div>'}
    </div>
  `).join('');
}

Router.register('home', {
  render() {
    const name = Store.get('custName', 'Customer');
    const loc = Store.get('custLocation', '');
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '👤';
    const whyHtml = WHY_DOTOR.map(w => `
      <div class="why-item">
        <span class="why-icon">${w.icon}</span>
        <div>
          <div class="why-title">${w.title}</div>
          <div class="why-desc">${w.desc}</div>
        </div>
      </div>
    `).join('');

    // Bento grid: 2 large tiles + 8 color-tinted category tiles
    const bentoTilesHtml = BENTO_SERVICES.map(s => `
      <div class="bento-tile glass glass-tint-${s.tint}" onclick="window.bentoTileClick('${s.id}')">
        <span class="bento-tile-icon">${s.icon}</span>
        <div class="bento-tile-title">${s.name}</div>
      </div>
    `).join('');

    return {
      html: `
        <div class="screen">
          <!-- Bento Glass: Header with logo badge + icon buttons + avatar -->
          <div class="header" style="padding:12px 16px;padding-top:50px;gap:8px">
            <div class="splash-logo" style="width:44px;height:44px;border-radius:22px;margin-bottom:0;flex-shrink:0" onclick="Router.navigate('schedule')">
              <span style="font-size:22px;font-weight:900;color:var(--primary);position:relative;z-index:1">D</span>
            </div>
            <div style="flex:1;min-width:0">
              <div class="home-greeting" id="greeting" style="font-size:11px">${getGreeting()}</div>
              <div class="home-name" style="font-size:15px">${name}</div>
              <div class="home-loc" id="homeLoc" style="font-size:11px">📍 ${loc || 'Set location...'}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
              <button class="header-icon-btn" onclick="window.toggleSearch()" aria-label="Search">🔍</button>
              <button class="header-icon-btn" onclick="showAlert('📸 Camera', 'Point camera at QR code to auto-book')" aria-label="Camera">📷</button>
              <button class="header-icon-btn" onclick="showAlert('🔔 Notifications', 'No new notifications')" aria-label="Notifications">
                🔔<span class="notif-badge"></span>
              </button>
              <div class="home-avatar" onclick="Router.navigate('customer-profile')" style="width:40px;height:40px;border-radius:20px;font-size:14px;font-weight:800;color:var(--white)">
                ${initials}
              </div>
            </div>
          </div>

          <!-- Bento Glass: Search bar (hidden, toggled by 🔍 header button) -->
          <div class="search-bar" id="searchBar" style="display:none">
            <span style="font-size:16px">🔍</span>
            <input class="form-input" id="searchInput" placeholder="Search services, brands or repairs..." oninput="window.filterHome(event)" />
          </div>

          <!-- Bento Grid: 2 large tiles + 8 color-tinted category tiles -->
          <div class="bento-grid">
            <div class="bento-tile bento-tile-wide glass glass-tint-orange" onclick="Router.navigate('schedule')">
              <div>
                <span class="bento-tile-icon" style="display:inline-block;margin-bottom:4px">🛠️</span>
                <div class="bento-tile-title">Book Repair</div>
                <div class="bento-tile-sub">Verified technicians ✓</div>
              </div>
              <span style="font-size:32px">📍</span>
            </div>
            <div class="bento-tile bento-tile-wide glass glass-tint-blue" onclick="Router.navigate('tracking')">
              <div>
                <span class="bento-tile-icon" style="display:inline-block;margin-bottom:4px">🚴</span>
                <div class="bento-tile-title">Track Order</div>
                <div class="bento-tile-sub">Live status ✓</div>
              </div>
              <span style="font-size:32px">📍</span>
            </div>
            ${bentoTilesHtml}
          </div>

          <!-- Promo Carousel -->
          <div class="carousel-wrapper" id="carouselWrapper">
            <div class="glass carousel-container">
              <div class="carousel-track" id="carouselTrack">
                <div class="carousel-slide carousel-slide-gradient" onclick="Router.navigate('schedule')">
                  <div class="carousel-text">
                    <div class="carousel-title">🎉 First Repair Offer!</div>
                    <div class="carousel-sub">10% off — Use code <strong>DOTOR10</strong> 🔥</div>
                  </div>
                  <div class="carousel-cta">🚀 Get Started</div>
                </div>
                <div class="carousel-slide carousel-slide-dark" onclick="Router.navigate('tracking')">
                  <div class="carousel-text">
                    <div class="carousel-title">🛵 Live Tracking</div>
                    <div class="carousel-sub">See your technician arrive in real-time 📍</div>
                  </div>
                  <div class="carousel-cta">📍 Track Now</div>
                </div>
                <div class="carousel-slide carousel-slide-gradient" onclick="showAlert('✨ Premium Service', 'Get priority service with our DoToR Pass! Starting at ₹99/month')">
                  <div class="carousel-text">
                    <div class="carousel-title">✨ DoToR Pass</div>
                    <div class="carousel-sub">Priority service & exclusive discounts 🎫</div>
                  </div>
                  <div class="carousel-cta">🎉 Learn More</div>
                </div>
              </div>
            </div>
            <div class="carousel-arrows" id="carouselArrows">
              <button class="carousel-arrow" id="carouselPrev" onclick="window.carouselPrev()">‹</button>
              <button class="carousel-arrow" id="carouselNext" onclick="window.carouselNext()">›</button>
            </div>
            <div class="carousel-dots" id="carouselDots"></div>
          </div>

          <!-- Active Booking Card -->
          <div id="activeBookingContainer" style="display:none">
            <div class="active-booking">
              <div class="active-booking-header">
                <span class="active-booking-label">📋 Active Booking</span>
                <span class="active-booking-status" id="activeBookingStatus">In Progress</span>
              </div>
              <div class="active-booking-title" id="activeBookingTitle">📱 Device Repair</div>
              <div class="active-booking-sub" id="activeBookingSub">🛵 Technician is on the way</div>
              <div class="active-booking-progress">
                <div class="progress-bar">
                  <div class="progress-bar-fill" id="activeBookingProgress" style="width:60%"></div>
                </div>
                <div class="progress-label">
                  <span>✅ Booked</span>
                  <span id="activeBookingStep">🚗 En Route</span>
                  <span>✅ Done</span>
                </div>
              </div>
              <div class="active-booking-actions">
                <button class="btn btn-primary btn-sm" onclick="Router.navigate('tracking')">🛵 Track</button>
                <button class="btn btn-success btn-sm" onclick="window.callTechHome()">📞 Call</button>
              </div>
            </div>
          </div>

          <!-- Full Service Selection (hidden by default, shown for "More" tile or brand/repair flow) -->
          <div id="serviceSection" style="display:none">
            <div class="step-back-row" onclick="window.backToBento()">← All Services</div>
            <div class="section-title">🔧 All Services</div>
            <div class="service-grid" id="serviceGrid">${allServicesHtml()}</div>
          </div>

          <div id="brandSection" style="display:none">
            <div class="step-back-row" onclick="window.backToServices()">← All Services</div>
            <div class="section-title" id="brandSectionTitle">Step 2 — Select Brand/Model</div>
            <div class="brand-grid" id="brandGrid"></div>
          </div>
          <div id="repairSection" style="display:none">
            <div class="step-back-row" onclick="window.backToBrands()">← Select Brand</div>
            <div class="section-title" id="repairSectionTitle">Step 3 — What needs Repair?</div>
            <div id="repairList"></div>
          </div>

          <div class="section-title">⭐ Why DoToR?</div>
          ${whyHtml}
          <div style="height:40px"></div>
        </div>
      `,
      init() {
        let selectedService = null;
        let selectedBrand = null;
        let carouselIndex = 0;
        let carouselInterval = null;
        const CAROUSEL_INTERVAL = 4000;

        // ─── Toggle Search Bar ────────────────────────────
        window.toggleSearch = () => {
          const bar = document.getElementById('searchBar');
          if (bar) {
            bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
            if (bar.style.display !== 'none') {
              document.getElementById('searchInput')?.focus();
            }
          }
        };

        // ─── Bento Tile Click ────────────────────────────
        window.bentoTileClick = (tileId) => {
          if (tileId === 'more') {
            // Show full service grid
            document.getElementById('serviceSection').style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          // Map bento tile to a service and start the booking flow
          const svc = SERVICES.find(s => s.id === tileId);
          if (svc) {
            window.selectService(tileId);
          }
        };

        // ─── Back to Bento (from full service list) ──────
        window.backToBento = () => {
          document.getElementById('serviceSection').style.display = 'none';
          document.getElementById('brandSection').style.display = 'none';
          document.getElementById('repairSection').style.display = 'none';
          selectedService = null;
          selectedBrand = null;
        };

        // ─── Carousel ─────────────────────────────────────
        function initCarousel() {
          const track = document.getElementById('carouselTrack');
          const dots = document.getElementById('carouselDots');
          if (!track || !dots) return;
          const slides = track.querySelectorAll('.carousel-slide');
          dots.innerHTML = Array.from(slides).map((_, i) =>
            `<button class="carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}" onclick="window.carouselGoTo(${i})"></button>`
          ).join('');
          startCarouselAuto();
          const wrapper = document.getElementById('carouselWrapper');
          if (wrapper) {
            wrapper.addEventListener('mouseenter', stopCarouselAuto);
            wrapper.addEventListener('mouseleave', startCarouselAuto);
            let touchStartX = 0;
            wrapper.addEventListener('touchstart', (e) => {
              touchStartX = e.changedTouches[0].screenX;
              stopCarouselAuto();
            }, { passive: true });
            wrapper.addEventListener('touchend', (e) => {
              const diff = touchStartX - e.changedTouches[0].screenX;
              if (Math.abs(diff) > 50) {
                if (diff > 0) window.carouselNext();
                else window.carouselPrev();
              }
              startCarouselAuto();
            }, { passive: true });
          }
        }

        function updateCarousel() {
          const track = document.getElementById('carouselTrack');
          const dots = document.getElementById('carouselDots');
          if (!track || !dots) return;
          const slides = track.querySelectorAll('.carousel-slide');
          if (carouselIndex >= slides.length) carouselIndex = 0;
          if (carouselIndex < 0) carouselIndex = slides.length - 1;
          track.style.transform = `translateX(-${carouselIndex * 100}%)`;
          dots.querySelectorAll('.carousel-dot').forEach((d, i) => {
            d.classList.toggle('active', i === carouselIndex);
          });
        }

        function startCarouselAuto() {
          stopCarouselAuto();
          carouselInterval = setInterval(() => { carouselIndex++; updateCarousel(); }, CAROUSEL_INTERVAL);
        }

        function stopCarouselAuto() {
          if (carouselInterval) { clearInterval(carouselInterval); carouselInterval = null; }
        }

        window.carouselNext = () => { carouselIndex++; updateCarousel(); };
        window.carouselPrev = () => { carouselIndex--; updateCarousel(); };
        window.carouselGoTo = (i) => { carouselIndex = i; updateCarousel(); };
        initCarousel();

        // ─── Active Booking Card ───────────────────────────
        function initActiveBooking() {
          const container = document.getElementById('activeBookingContainer');
          const orderId = Store.get('lastOrderId', '');
          if (!container || !orderId) return;
          const ordersRef = firebase.database().ref('orders/' + orderId);
          const onOrder = (snap) => {
            if (!snap.exists()) { container.style.display = 'none'; return; }
            const order = snap.val();
            const activeStatuses = ['pending', 'accepted', 'assigned'];
            if (!activeStatuses.includes(order.status)) { container.style.display = 'none'; return; }
            container.style.display = 'block';
            const shortId = orderId.slice(-5).toUpperCase();
            document.getElementById('activeBookingTitle').textContent =
              `📱 ${order.service || 'Service'}${order.brand ? ' • ' + order.brand : ''}`;
            const statusMap = {
              'pending': { label: '⏳ Pending', step: '📋 Looking for tech', width: '25%' },
              'accepted': { label: '🛵 En Route', step: '🚗 Technician on the way', width: '60%' },
              'assigned': { label: '🛵 On The Way', step: '🚗 Technician on the way', width: '75%' },
            };
            const info = statusMap[order.status] || { label: '⏳ Pending', step: '📋 Processing', width: '20%' };
            document.getElementById('activeBookingStatus').textContent = `#DR${shortId}`;
            document.getElementById('activeBookingSub').textContent =
              `🛵 ${info.step}${order.location ? ' • 📍 ' + order.location : ''}`;
            document.getElementById('activeBookingProgress').style.width = info.width;
            document.getElementById('activeBookingStep').textContent = info.step;
          };
          ordersRef.on('value', onOrder);
          window._activeBookingCleanup = () => ordersRef.off('value', onOrder);
        }
        initActiveBooking();

        // ─── Call tech helper ──────────────────────────────
        window.callTechHome = () => {
          const orderId = Store.get('lastOrderId', '');
          if (!orderId) { showAlert('No Booking', 'No active booking found.'); return; }
          firebase.database().ref('orders/' + orderId).once('value').then(snap => {
            if (!snap.exists()) { showAlert('No Booking', 'No active booking found.'); return; }
            const order = snap.val();
            const techPhone = order.techPhone || '';
            if (techPhone) { window.open('tel:+91' + techPhone); }
            else {
              firebase.database().ref('techInfo/phone').once('value').then(tsnap => {
                const phone = tsnap.val();
                if (phone) window.open('tel:+91' + phone);
                else showAlert('Not Available', 'Technician phone not available yet!');
              });
            }
          });
        };

        // ─── Service selection flow (unchanged logic) ──────
        window.selectService = (id) => {
          const svc = SERVICES.find(s => s.id === id);
          if (!svc) return;
          selectedService = svc;
          selectedBrand = null;
          if (svc.brands.length) {
            document.getElementById('serviceSection').style.display = 'block';
            const brandGrid = document.getElementById('brandGrid');
            brandGrid.innerHTML = svc.brands.map(b => `
              <div class="brand-card" data-brand="${b}" onclick="window.selectBrand('${b}')">
                <span class="device-icon">${svc.icon}</span>
                <div class="device-name">${b}</div>
              </div>
            `).join('');
            document.getElementById('brandSectionTitle').textContent = `Step 2 — Select ${svc.name} Model`;
            document.getElementById('brandSection').style.display = 'block';
            document.getElementById('repairSection').style.display = 'none';
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            window.bookService(null);
          }
        };

        window.backToServices = () => {
          selectedService = null;
          selectedBrand = null;
          document.getElementById('brandSection').style.display = 'none';
          document.getElementById('repairSection').style.display = 'none';
        };

        window.selectBrand = (brand) => {
          selectedBrand = brand;
          document.querySelectorAll('.brand-card').forEach(c => c.classList.remove('active'));
          document.querySelector(`.brand-card[data-brand="${brand}"]`).classList.add('active');
          if (selectedService.repairs.length) {
            const repairList = document.getElementById('repairList');
            repairList.innerHTML = selectedService.repairs.map(r => `
              <div class="repair-item" onclick="window.bookService('${r}')">
                <span class="repair-text">🔧 ${r}</span>
                <span class="repair-arrow">→</span>
              </div>
            `).join('');
            document.getElementById('repairSectionTitle').textContent = `Step 3 — What needs Repair?`;
            document.getElementById('repairSection').style.display = 'block';
          } else { window.bookService(null); }
        };

        window.backToBrands = () => { selectedBrand = null; document.getElementById('repairSection').style.display = 'none'; };

        window.bookService = async (repair) => {
          const svc = selectedService;
          const name = Store.get('custName', 'Customer');
          const phone = Store.get('custPhone', '');
          const pushToken = Store.get('pushToken', '');
          const brand = selectedBrand || '';
          const repairText = repair || 'General Service';
          Store.set('lastBrand', brand);
          Store.set('lastRepair', repairText);
          Store.set('lastService', svc.name);
          let locStr = Store.get('custLocation', '');
          if (!locStr) {
            const pos = await getCurrentPositionOnce();
            locStr = pos && pos.lat ? `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}` : '';
            if (locStr) Store.set('custLocation', locStr);
          }
          const order = {
            customerName: name, customerPhone: phone, customerPushToken: pushToken,
            location: locStr, pincode: '', service: svc.name,
            brand: brand, repair: repairText, status: 'pending',
            time: new Date().toLocaleTimeString()
          };
          try {
            const newRef = firebase.database().ref('orders').push(order);
            const orderId = newRef.key;
            Store.set('lastOrderId', orderId);
            const detail = `${svc.icon} ${svc.name}${brand ? ' • ' + brand : ''}${repair ? ' • ' + repair : ''}`;
            showAlert('✅ Booking Confirmed!', `${detail}\n\nTrack your technician?`, [
              { text: 'Track Now', onPress: () => Router.navigate('tracking') },
              { text: '💬 Chat', onPress: () => Router.navigate('chat', { orderId, role: 'cust', customerName: name }) },
              { text: '💰 Pay', onPress: () => Router.navigate('payment') },
              { text: 'Later' }
            ]);
            window.backToBento();
          } catch (e) { showAlert('Error', 'Booking failed! Try again.'); }
        };

        // ─── GPS & Search ──────────────────────────────────
        startGPS((lat, lng) => {
          const locStr = lat ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : '';
          const locEl = document.getElementById('homeLoc');
          if (locEl) locEl.textContent = '📍 ' + locStr;
          Store.set('custLocation', locStr);
        });

        window.filterHome = (e) => {
          const q = e.target.value.toLowerCase().trim();
          document.querySelectorAll('.service-card').forEach(c => {
            const cName = c.querySelector('.service-card-name')?.textContent?.toLowerCase() || '';
            c.style.display = (!q || cName.includes(q)) ? '' : 'none';
          });
          document.querySelectorAll('.bento-tile').forEach(c => {
            const cName = c.querySelector('.bento-tile-title')?.textContent?.toLowerCase() || '';
            c.style.display = (!q || cName.includes(q)) ? '' : 'none';
          });
          document.querySelectorAll('.brand-card').forEach(c => {
            const cName = c.querySelector('.device-name')?.textContent?.toLowerCase() || '';
            c.style.display = (!q || cName.includes(q)) ? '' : 'none';
          });
          document.querySelectorAll('.repair-item').forEach(c => {
            const text = c.querySelector('.repair-text')?.textContent?.toLowerCase() || '';
            c.style.display = (!q || text.includes(q)) ? '' : 'none';
          });
        };

        return () => {
          stopGPS();
          stopCarouselAuto();
          if (window._activeBookingCleanup) { window._activeBookingCleanup(); delete window._activeBookingCleanup; }
          delete window.toggleSearch;
          delete window.bentoTileClick;
          delete window.backToBento;
          delete window.selectService;
          delete window.backToServices;
          delete window.selectBrand;
          delete window.backToBrands;
          delete window.bookService;
          delete window.filterHome;
          delete window.carouselNext;
          delete window.carouselPrev;
          delete window.carouselGoTo;
          delete window.callTechHome;
        };
      }
    };
  }
});
