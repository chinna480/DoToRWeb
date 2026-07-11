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
const ELECTRICIAN_ISSUES = ['Switchboard Repair', 'Wiring Issue', 'Fan Repair', 'Light Repair', 'MCB/Tripping', 'New Connection', 'Heater/Geyser', 'Inverter Wiring'];
const PLUMBING_ISSUES = ['Tap Repair', 'Pipe Leakage', 'Drain Cleaning', 'Flush Tank Repair', 'Water Heater', 'Bathroom Fitting', 'Sink Repair', 'Overhead Tank'];
const CCTV_ISSUES = ['New Installation', 'Camera Not Working', 'DVR/NVR Setup', 'Wireless Setup', 'Night Vision Issue', 'Cable Replacement', 'System Upgrade', 'Remote View Setup'];
const WIFI_ISSUES = ['New Router Setup', 'Slow Internet', 'No Connection', 'Range Issue', 'Router Repair', 'LAN Wiring', 'Mesh Setup', 'Configuration'];
const RO_ISSUES = ['Service & Cleaning', 'Filter Replacement', 'Membrane Change', 'Water Flow Low', 'Leakage', 'Tank Not Filling', 'Purifier Not Working', 'Installation'];
const INVERTER_ISSUES = ['Battery Replacement', 'Inverter Repair', 'New Installation', 'UPS Service', 'Wiring Issue', 'Battery Low Backup', 'Panel Check', 'AMC Service'];
const SERVICES = [
  { id: 'mobile',   icon: '📱',    name: 'Mobile Repair',          brands: PHONE_BRANDS,   repairs: PHONE_REPAIRS },
  { id: 'laptop',   icon: '💻',    name: 'Laptop & PC Repair',     brands: LAPTOP_BRANDS,  repairs: LAPTOP_REPAIRS },
  { id: 'tv',       icon: '📺',    name: 'TV Repair',              brands: TV_BRANDS,      repairs: TV_REPAIRS },
  { id: 'ac',       icon: '❄️',    name: 'AC Service & Repair',    brands: AC_BRANDS,      repairs: AC_REPAIRS },
  { id: 'fridge',   icon: '🧊',    name: 'Refrigerator Repair',    brands: FRIDGE_BRANDS,  repairs: FRIDGE_REPAIRS },
  { id: 'washing',  icon: '🧺',    name: 'Washing Machine Repair',  brands: WASHING_BRANDS, repairs: WASHING_REPAIRS },
  { id: 'electric', icon: '🔌',    name: 'Electrician Services',           brands: [],             repairs: ELECTRICIAN_ISSUES },
  { id: 'plumbing', icon: '🚰',    name: 'Plumbing Services',              brands: [],             repairs: PLUMBING_ISSUES },
  { id: 'cctv',     icon: '📡',    name: 'CCTV Installation & Service',    brands: [],             repairs: CCTV_ISSUES },
  { id: 'wifi',     icon: '🌐',    name: 'Wi-Fi Router Setup',             brands: [],             repairs: WIFI_ISSUES },
  { id: 'ro',       icon: '💧',    name: 'RO Water Purifier Service',      brands: [],             repairs: RO_ISSUES },
  { id: 'inverter', icon: '🔋',    name: 'Inverter & UPS Service',         brands: [],             repairs: INVERTER_ISSUES },
];

// Bento glass service categories (show 5 tiles on home screen, rest in "More")
const BENTO_SERVICES = [
  { id: 'mobile',   icon: '📱', name: 'Mobile Device',        tint: 'purple' },
  { id: 'laptop',   icon: '💻', name: 'Laptop or PC',         tint: 'orange' },
  { id: 'tv',       icon: '📺', name: 'TV Repair',            tint: 'pink' },
  { id: 'ac',       icon: '❄️', name: 'AC Service & Repair',  tint: 'teal' },
  { id: 'washing',  icon: '🧺', name: 'Washing Machine',      tint: 'yellow' },
  { id: 'more',     icon: '➕', name: 'More',                  tint: 'red' },
];

const WHY_DOTOR = [
  { icon: '🏠', title: 'Doorstep Service', desc: 'Repair at your doorstep!' },
  { icon: '👀', title: 'Repair in Front of You', desc: '100% transparent process!' },
  { icon: '⚡', title: 'Fast Service', desc: 'Arrives within 60 mins!' },
  { icon: '💰', title: 'Best Price', desc: 'No hidden charges ever!' },
];

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

    // Carousel slides: all 12 services auto-rotating (service IDs are plain alphanumeric, no esc needed)
    const carouselSlidesHtml = SERVICES.map(s => `
      <div class="carousel-slide carousel-slide-gradient" onclick="window.bentoTileClick('${s.id}')">
        <div class="carousel-text">
          <div style="font-size:36px;margin-bottom:4px">${s.icon}</div>
          <div class="carousel-title">${s.name}</div>
          <div class="carousel-sub">Tap to book — Verified technicians ✓</div>
        </div>
        <div class="carousel-cta">📅 Book Now</div>
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
            <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
              <button class="header-icon-btn" onclick="window.toggleSearch()" aria-label="Search">🔍</button>
              <button class="header-icon-btn" onclick="showAlert('🔔 Notifications', 'No new notifications')" aria-label="Notifications">
                🔔<span class="notif-badge"></span>
              </button>
              <div class="home-avatar" onclick="Router.navigate('customer-profile')" style="width:40px;height:40px;border-radius:20px;font-size:13px;font-weight:800;color:var(--white)">
                ${initials}
              </div>
            </div>
          </div>

          <!-- Bento Glass: Search bar (hidden, toggled by 🔍 header button) -->
          <div class="search-bar" id="searchBar" style="display:none">
            <span style="font-size:16px">🔍</span>
            <input class="form-input" id="searchInput" placeholder="Search services, brands or repairs..." oninput="window.filterHome(event)" />
          </div>

          <!-- Home Content (everything shown on the main home screen, hidden when showing all services) -->
          <div id="homeContent">
            <!-- Bento Grid: 2 large tiles + 8 color-tinted category tiles -->
            <div class="bento-grid">
              <div class="bento-tile bento-tile-wide glass glass-tint-orange" onclick="Router.navigate('services')">
                <div>
                  <span class="bento-tile-icon" style="display:inline-block;margin-bottom:4px">🛠️🧰</span>
                  <div class="bento-tile-title">Book Repair</div>
                  <div class="bento-tile-sub">Choose your repair type ✓</div>
                </div>
                <span style="font-size:32px">🔧</span>
              </div>
              <div class="bento-tile bento-tile-wide glass glass-tint-blue" onclick="Router.navigate('tracking')">
                <div>
                  <span class="bento-tile-icon" style="display:inline-block;margin-bottom:4px">📍</span>
                  <div class="bento-tile-title">Track Order</div>
                  <div class="bento-tile-sub">Live status ✓</div>
                </div>
                <span style="font-size:32px">🚴</span>
              </div>
              ${bentoTilesHtml}
            </div>

            <!-- Services Carousel (all 12 services auto-rotating) -->
            <div class="carousel-wrapper" id="carouselWrapper">
              <div class="glass carousel-container">
                <div class="carousel-track" id="carouselTrack">
                  ${carouselSlidesHtml}
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
                  <span class="active-booking-label">📦 Active Booking</span>
                  <span class="active-booking-status" id="activeBookingStatus">In Progress</span>
                </div>
                <div class="active-booking-title" id="activeBookingTitle">📱 Device Repair</div>
                <div class="active-booking-sub" id="activeBookingSub">🛵 Order in progress</div>
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
                  <button class="btn btn-success btn-sm" onclick="window.callTechHome()">📞 Call</button>
                  <button class="btn btn-primary btn-sm" onclick="Router.navigate('tracking')">🛵 Track Order</button>
                </div>
              </div>
            </div>

            <div class="section-title">⭐ Why DoToR?</div>
            ${whyHtml}
          </div>

          <!-- ─── Booking Wizard (8-step flow) ─── -->
          <div id="bookingWizard" style="display:none">
            <!-- Wizard Header -->
            <div class="step-back-row" onclick="window.closeWizard()">← Back</div>
            <div style="margin:20px 15px 10px;position:relative">
              <div style="font-size:18px;font-weight:900;color:var(--text)" id="wizardTitle">📱 Book Service</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:3px" id="wizardStepLabel">Step 1 of 6</div>
              <div style="display:flex;gap:4px;margin-top:10px" id="wizardProgress"></div>
            </div>

            <!-- Step 1: Brand Selection -->
            <div class="wizard-step" id="wizardStep1">
              <div style="font-size:15px;font-weight:800;color:var(--text);margin:0 18px 12px">🏷️ Select Brand</div>
              <div class="brand-grid" id="wizardBrandGrid"></div>
              <div class="btn-row" style="margin:15px 18px 0">
                <button class="btn btn-primary btn-sm" onclick="window.nextStep()" style="flex:1" id="wizardBrandNext" disabled>Next →</button>
              </div>
            </div>

            <!-- Step 2: Model -->
            <div class="wizard-step" id="wizardStep2" style="display:none">
              <div style="font-size:15px;font-weight:800;color:var(--text);margin:0 18px 12px">📱 Device Model</div>
              <div class="glass" style="margin:0 18px;padding:14px">
                <input class="form-input" id="wizardModel" placeholder="e.g. iPhone 14 Pro Max, Galaxy S23" style="width:100%;font-size:14px" />
              </div>
              <div class="btn-row" style="margin:15px 18px 0">
                <button class="btn btn-outline btn-sm" onclick="window.prevStep()" style="flex:1">← Back</button>
                <button class="btn btn-primary btn-sm" onclick="window.nextStep()" style="flex:1">Next →</button>
              </div>
            </div>

            <!-- Step 3: Describe Issue -->
            <div class="wizard-step" id="wizardStep3" style="display:none">
              <div style="font-size:15px;font-weight:800;color:var(--text);margin:0 18px 12px">✍️ Describe the Issue</div>
              <!-- Quick-select chips -->
              <div id="issueChips" style="display:flex;flex-wrap:wrap;gap:8px;margin:0 18px 12px"></div>
              <div class="glass" style="margin:0 18px;padding:12px">
                <textarea class="form-textarea" id="wizardIssue" placeholder="Tell us what's wrong... or pick one above" style="min-height:100px;border:none;box-shadow:none;background:transparent"></textarea>
              </div>
              <div class="btn-row" style="margin:15px 18px 0">
                <button class="btn btn-outline btn-sm" onclick="window.prevStep()" style="flex:1">← Back</button>
                <button class="btn btn-primary btn-sm" onclick="window.nextStep()" style="flex:1">Next →</button>
              </div>
            </div>

            <!-- Step 4: Add Photos -->
            <div class="wizard-step" id="wizardStep4" style="display:none">
              <div style="font-size:15px;font-weight:800;color:var(--text);margin:0 18px 12px">📸 Add Photos</div>
              <div style="margin:0 18px">
                <div class="upload-box" onclick="document.getElementById('wizardPhotoInput').click()">
                  <div class="upload-icon">📷</div>
                  <div class="upload-text">Tap to add photos</div>
                  <div class="upload-sub">Show us the issue for faster service</div>
                </div>
                <input type="file" id="wizardPhotoInput" accept="image/*" multiple style="display:none" onchange="window.handlePhotoUpload(event)" />
                <div id="wizardPhotoPreview" style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"></div>
              </div>
              <div class="btn-row" style="margin:15px 18px 0">
                <button class="btn btn-outline btn-sm" onclick="window.prevStep()" style="flex:1">← Back</button>
                <button class="btn btn-primary btn-sm" onclick="window.nextStep()" style="flex:1">Next →</button>
              </div>
            </div>

            <!-- Step 5: Repair Location -->
            <div class="wizard-step" id="wizardStep5" style="display:none">
              <div style="font-size:15px;font-weight:800;color:var(--text);margin:0 18px 12px">📍 Repair Location</div>
              <div class="glass" style="margin:0 18px 12px;padding:14px">
                <div class="form-label" style="margin-bottom:6px">📍 Address</div>
                <input class="form-input" id="wizardAddress" placeholder="Enter your full address" style="width:100%;font-size:14px" />
              </div>
              <div style="display:flex;gap:8px;margin:0 18px">
                <button class="btn btn-outline btn-sm" onclick="window.useCurrentLocation()" style="flex:1">📍 Current Location</button>
                <button class="btn btn-outline btn-sm" onclick="window.selectOnMap()" style="flex:1">🗺️ Select on Map</button>
              </div>
              <div id="wizardLocationInfo" style="margin:10px 18px 0;font-size:12px;color:var(--text-secondary);display:none"></div>
              <div class="btn-row" style="margin:15px 18px 0">
                <button class="btn btn-outline btn-sm" onclick="window.prevStep()" style="flex:1">← Back</button>
                <button class="btn btn-primary btn-sm" onclick="window.nextStep()" style="flex:1">Next →</button>
              </div>
            </div>

            <!-- Step 6: Pincode -->
            <div class="wizard-step" id="wizardStep6" style="display:none">
              <div style="font-size:15px;font-weight:800;color:var(--text);margin:0 18px 12px">📮 Pincode</div>
              <div class="glass" style="margin:0 18px;padding:14px">
                <input class="form-input" id="wizardPincode" placeholder="Enter your area pincode" style="width:100%;font-size:14px" type="tel" maxlength="6" />
              </div>
              <div class="btn-row" style="margin:15px 18px 0">
                <button class="btn btn-outline btn-sm" onclick="window.prevStep()" style="flex:1">← Back</button>
                <button class="btn btn-primary btn-sm" onclick="window.nextStep()" style="flex:1">Next →</button>
              </div>
            </div>

            <!-- Step 7: Schedule -->
            <div class="wizard-step" id="wizardStep7" style="display:none">
              <div style="font-size:15px;font-weight:800;color:var(--text);margin:0 18px 12px">📅 Schedule</div>
              
              <!-- Schedule Toggle -->
              <div class="glass" style="margin:0 18px 12px;padding:14px">
                <div class="form-label" style="margin-bottom:10px">⏰ When do you need service?</div>
                <div style="display:flex;gap:8px">
                  <button class="btn" id="scheduleImmediateBtn" onclick="window.selectScheduleMode('immediate')" style="flex:1;padding:10px 8px;border-radius:12px;font-size:13px;font-weight:700;border:2px solid var(--glass-border);background:var(--clay-bg);color:var(--text);cursor:pointer;transition:all 0.2s ease">
                    ⚡ Do It Now
                  </button>
                  <button class="btn" id="scheduleLaterBtn" onclick="window.selectScheduleMode('later')" style="flex:1;padding:10px 8px;border-radius:12px;font-size:13px;font-weight:700;border:2px solid var(--glass-border);background:var(--clay-bg);color:var(--text);cursor:pointer;transition:all 0.2s ease">
                    📅 Schedule for Later
                  </button>
                </div>
              </div>

              <!-- Date/Time Picker (shown when 'later' is selected) -->
              <div id="schedulePickerSection" style="display:none;margin:0 18px 12px">
                <div class="glass" style="padding:14px">
                  <div class="form-label" style="margin-bottom:8px">📅 Select Date</div>
                  <div class="date-row" id="wizardDateRow" style="overflow-x:auto;display:flex;gap:6px;padding-bottom:4px"></div>
                  <div class="form-label" style="margin:12px 0 8px">⏰ Select Time Slot</div>
                  <div class="slots-grid" id="wizardSlotsGrid" style="display:flex;flex-wrap:wrap;gap:6px"></div>
                  <div id="wizardScheduleSummary" style="display:none;margin-top:10px;padding:10px;background:var(--clay-card);border-radius:10px;font-size:13px;color:var(--primary);font-weight:700;text-align:center"></div>
                </div>
              </div>


              <div class="btn-row" style="margin:15px 18px 0">
                <button class="btn btn-outline btn-sm" onclick="window.prevStep()" style="flex:1">← Back</button>
                <button class="btn btn-primary btn-sm" onclick="window.nextStep()" style="flex:1">Next →</button>
              </div>
            </div>

            <!-- Step 8: Review & Confirm -->
            <div class="wizard-step" id="wizardStep8" style="display:none">
              <div style="font-size:15px;font-weight:800;color:var(--text);margin:0 18px 12px">✅ Review & Confirm</div>
              <div class="glass" style="margin:0 18px;padding:16px">
                <div id="wizardReviewContent"></div>
                <div style="height:1px;background:var(--clay-divider);margin:12px 0"></div>
                <button class="btn btn-success btn-block" onclick="window.confirmBooking()">✅ Confirm Booking</button>
              </div>
              <div class="btn-row" style="margin:15px 18px 0">
                <button class="btn btn-outline btn-sm" onclick="window.prevStep()" style="flex:1">← Back</button>
              </div>
            </div>
          </div>

          <div style="height:40px"></div>
        </div>
      `,
      init(params) {
        let selectedService = null;
        let selectedBrand = null;
        let carouselIndex = 0;
        let carouselInterval = null;
        const CAROUSEL_INTERVAL = 4000;

        // ─── Auto-select service (from services page) ────
        if (params && params.service) {
          // Small delay to let the DOM render, then auto-open the booking wizard
          setTimeout(() => {
            const svc = SERVICES.find(s => s.id === params.service);
            if (svc) window.selectService(params.service);
          }, 100);
        }

        // ─── Bento Tile Click ────────────────────────────
        window.bentoTileClick = (tileId) => {
          if (tileId === 'more') {
            // Navigate to the dedicated All Services page
            Router.navigate('services');
            return;
          }
          // Map bento tile to a service and start the booking flow
          const svc = SERVICES.find(s => s.id === tileId);
          if (svc) {
            window.selectService(tileId);
          }
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
              'pending': { label: '⏳ Pending', step: '📋 Confirming', width: '25%' },
              'accepted': { label: '🛵 In Progress', step: '🔧 Repair in progress', width: '60%' },
              'assigned': { label: '🛵 In Progress', step: '🔧 Repair in progress', width: '75%' },
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

        // ─── Booking Wizard ──────────────────────────────
        let bookingData = {};
        let wizardPhotos = [];
        const TOTAL_STEPS = 8;

        window.selectService = (id) => {
          const svc = SERVICES.find(s => s.id === id);
          if (!svc) return;
          selectedService = svc;
          bookingData = { service: svc.name, icon: svc.icon };
          wizardPhotos = [];

          // Hide home content, show wizard
          document.getElementById('homeContent').style.display = 'none';
          document.getElementById('bookingWizard').style.display = 'block';
          document.getElementById('wizardTitle').textContent = `${svc.icon} ${svc.name}`;

          if (svc.brands.length) {
            // Has brands: start at step 1 (brand selection)
            const brandGrid = document.getElementById('wizardBrandGrid');
            brandGrid.innerHTML = svc.brands.map(b => `
              <div class="brand-card" data-brand="${b}" onclick="window.wizardSelectBrand('${b}')">
                <span class="device-icon">${svc.icon}</span>
                <div class="device-name">${b}</div>
              </div>
            `).join('');
            window.goToStep(1);
          } else {
            // No brands: skip to describe issue (step 3)
            bookingData.brand = '';
            bookingData.model = '';
            window.goToStep(3);
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        window.closeWizard = () => {
          document.getElementById('bookingWizard').style.display = 'none';
          document.getElementById('homeContent').style.display = 'block';
          selectedService = null;
          bookingData = {};
        };

        // ─── Wizard Step Navigation ──────────────────────
        window.currentStep = 1;

        window.goToStep = (step) => {
          window.currentStep = step;
          // Hide all steps
          for (let i = 1; i <= TOTAL_STEPS; i++) {
            const el = document.getElementById('wizardStep' + i);
            if (el) el.style.display = 'none';
          }
          // Show current step
          const current = document.getElementById('wizardStep' + step);
          if (current) current.style.display = 'block';

          document.getElementById('wizardStepLabel').textContent = `Step ${step} of ${TOTAL_STEPS}`;

          // Update progress dots
          updateProgress(step);

          // Populate issue chips when reaching step 3
          if (step === 3) populateIssueChips();

          // Init schedule UI when reaching step 7
          if (step === 7) {
            // Restore schedule mode if previously selected
            if (bookingData.scheduleMode === 'later') {
              document.getElementById('scheduleLaterBtn').style.borderColor = 'var(--primary)';
              document.getElementById('scheduleLaterBtn').style.background = 'var(--primary-light)';
              document.getElementById('scheduleImmediateBtn').style.borderColor = 'var(--glass-border)';
              document.getElementById('scheduleImmediateBtn').style.background = 'var(--clay-bg)';
              document.getElementById('schedulePickerSection').style.display = 'block';
              initWizardSchedulePicker();
            } else if (bookingData.scheduleMode === 'immediate') {
              document.getElementById('scheduleImmediateBtn').style.borderColor = 'var(--primary)';
              document.getElementById('scheduleImmediateBtn').style.background = 'var(--primary-light)';
              document.getElementById('scheduleLaterBtn').style.borderColor = 'var(--glass-border)';
              document.getElementById('scheduleLaterBtn').style.background = 'var(--clay-bg)';
            }
          }

          // Update review when on last step
          if (step === TOTAL_STEPS) updateReview();

          window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        function updateProgress(step) {
          const container = document.getElementById('wizardProgress');
          if (!container) return;
          container.innerHTML = '';
          for (let i = 1; i <= TOTAL_STEPS; i++) {
            const dot = document.createElement('div');
            dot.style.cssText = `
              flex:1;height:4px;border-radius:2px;
              background: ${i <= step ? 'var(--primary)' : 'var(--clay-dark)'};
              transition: background 0.3s ease;
            `;
            container.appendChild(dot);
          }
        }

        window.nextStep = () => {
          // Validate current step
          if (window.currentStep === 1 && !bookingData.brand) {
            showAlert('Select Brand', 'Please select a brand first');
            return;
          }
          if (window.currentStep === 2) {
            bookingData.model = document.getElementById('wizardModel').value.trim();
          }
          if (window.currentStep === 3) {
            bookingData.issue = document.getElementById('wizardIssue').value.trim();
          }
          if (window.currentStep === 4) {
            // Photos are optional
          }
          if (window.currentStep === 5) {
            bookingData.address = document.getElementById('wizardAddress').value.trim();
            if (!bookingData.address && !bookingData.location) {
              showAlert('Add Location', 'Please enter your address or use current location');
              return;
            }
          }
          if (window.currentStep === 6) {
            bookingData.pincode = document.getElementById('wizardPincode').value.trim();
            if (!bookingData.pincode || bookingData.pincode.length < 5) {
              showAlert('Enter Pincode', 'Please enter a valid 6-digit pincode');
              return;
            }
          }
          if (window.currentStep === 7) {
            if (!bookingData.scheduleMode) {
              showAlert('Select Schedule', 'Please choose "Do It Now" or "Schedule for Later"');
              return;
            }
            if (bookingData.scheduleMode === 'later' && (!bookingData.scheduleDate || !bookingData.scheduleSlot)) {
              showAlert('Select Date & Time', 'Please select a date and time slot for your scheduled service');
              return;
            }
          }
          if (window.currentStep < TOTAL_STEPS) window.goToStep(window.currentStep + 1);
        };

        window.prevStep = () => {
          if (window.currentStep > 1) {
            // Save field values before going back
            if (window.currentStep === 2) bookingData.model = document.getElementById('wizardModel').value.trim();
            if (window.currentStep === 3) bookingData.issue = document.getElementById('wizardIssue').value.trim();
            if (window.currentStep === 5) bookingData.address = document.getElementById('wizardAddress').value.trim();
            if (window.currentStep === 6) bookingData.pincode = document.getElementById('wizardPincode').value.trim();
            if (window.currentStep === 7) {
              // Don't save/sync schedule date/slot from DOM since they may be buttons, not inputs
            }
            window.goToStep(window.currentStep - 1);
          }
        };

        // ─── Issue Chips (quick-select on step 3) ───────
        function populateIssueChips() {
          const container = document.getElementById('issueChips');
          if (!container || !selectedService) return;
          const svc = selectedService;
          const issues = svc.repairs && svc.repairs.length ? svc.repairs : [];
          if (!issues.length) { container.innerHTML = ''; return; }
          container.innerHTML = issues.map(issue =>
            `<button class="issue-chip" data-issue="${esc(issue)}" onclick="window.selectIssueChip('${esc(issue)}')">🔧 ${esc(issue)}</button>`
          ).join('');
        }

        window.selectIssueChip = (issue) => {
          const textarea = document.getElementById('wizardIssue');
          if (textarea) {
            textarea.value = issue;
            bookingData.issue = issue;
            // Highlight selected chip via data-issue exact match
            document.querySelectorAll('.issue-chip').forEach(c => c.classList.remove('active'));
            document.querySelectorAll(`.issue-chip[data-issue="${issue}"]`).forEach(c => c.classList.add('active'));
          }
        };

        // ─── Brand Selection ─────────────────────────────
        window.wizardSelectBrand = (brand) => {
          bookingData.brand = brand;
          document.querySelectorAll('#wizardBrandGrid .brand-card').forEach(c => c.classList.remove('active'));
          const el = document.querySelector(`#wizardBrandGrid .brand-card[data-brand="${brand}"]`);
          if (el) el.classList.add('active');
          document.getElementById('wizardBrandNext').disabled = false;
        };

        // ─── Photo Upload ────────────────────────────────
        window.handlePhotoUpload = (event) => {
          const files = event.target.files;
          if (!files) return;
          const preview = document.getElementById('wizardPhotoPreview');
          for (const file of files) {
            if (wizardPhotos.length >= 6) {
              showAlert('Max 6 Photos', 'You can add up to 6 photos');
              break;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
              wizardPhotos.push(e.target.result);
              const thumb = document.createElement('div');
              thumb.style.cssText = 'width:72px;height:72px;border-radius:12px;overflow:hidden;position:relative;box-shadow:var(--clay-sm)';
              thumb.innerHTML = `
                <img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover" />
                <div onclick="window.removePhoto(${wizardPhotos.length - 1})" style="position:absolute;top:-4px;right:-4px;width:20px;height:20px;border-radius:10px;background:#ff4444;color:white;display:flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;font-weight:800">×</div>
              `;
              preview.appendChild(thumb);
            };
            reader.readAsDataURL(file);
          }
          event.target.value = '';
        };

        window.removePhoto = (index) => {
          wizardPhotos.splice(index, 1);
          const preview = document.getElementById('wizardPhotoPreview');
          preview.innerHTML = '';
          wizardPhotos.forEach((photo, i) => {
            const thumb = document.createElement('div');
            thumb.style.cssText = 'width:72px;height:72px;border-radius:12px;overflow:hidden;position:relative;box-shadow:var(--clay-sm)';
            thumb.innerHTML = `
              <img src="${photo}" style="width:100%;height:100%;object-fit:cover" />
              <div onclick="window.removePhoto(${i})" style="position:absolute;top:-4px;right:-4px;width:20px;height:20px;border-radius:10px;background:#ff4444;color:white;display:flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;font-weight:800">×</div>
            `;
            preview.appendChild(thumb);
          });
        };

        // ─── Location ─────────────────────────────────────
        window.useCurrentLocation = () => {
          const info = document.getElementById('wizardLocationInfo');
          info.style.display = 'block';
          info.textContent = '⏳ Getting your location...';
          getCurrentPositionOnce().then(pos => {
            if (pos && pos.lat) {
              bookingData.location = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
              info.textContent = `📍 Location set: ${bookingData.location}`;
              info.style.color = 'var(--primary)';
              Store.set('custLocation', bookingData.location);
              // Try to fill address from coordinates using reverse geocode
              fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.lat}&lon=${pos.lng}`)
                .then(r => r.json())
                .then(data => {
                  if (data && data.display_name) {
                    const addrEl = document.getElementById('wizardAddress');
                    if (addrEl && !addrEl.value) addrEl.value = data.display_name;
                  }
                }).catch(() => {});
            } else {
              info.textContent = '❌ Could not get location. Please enter address manually.';
              info.style.color = 'var(--danger)';
            }
          }).catch(() => {
            info.textContent = '❌ Location permission denied. Please enter address manually.';
            info.style.color = 'var(--danger)';
          });
        };

        // ─── Map Picker with Search & Autocomplete (Leaflet) ─
        window.selectOnMap = () => {
          // Create full-screen map overlay
          const overlay = document.createElement('div');
          overlay.id = 'mapPickerOverlay';
          overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;animation:clayFadeIn 0.2s ease';

          // Header bar with back button + title
          const header = document.createElement('div');
          header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;padding-top:50px;background:var(--dark);color:#fff;flex-shrink:0';
          header.innerHTML = '<button onclick="window.closeMapPicker()" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;font-weight:700">←</button><div style="font-size:16px;font-weight:800">🗺️ Select Location</div><div style="width:40px"></div>';

          // Search bar (below header, above map)
          const searchWrap = document.createElement('div');
          searchWrap.id = 'mapSearchWrap';
          searchWrap.style.cssText = 'position:relative;flex-shrink:0;background:var(--white);padding:8px 12px';
          searchWrap.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;background:var(--clay-bg);border:1px solid var(--glass-border);border-radius:12px;padding:10px 14px;box-shadow:var(--clay-inset)">
              <span style="font-size:16px;flex-shrink:0">🔍</span>
              <input id="mapSearchInput" type="text" placeholder="Search area, pincode or landmark..." autocomplete="off" style="flex:1;border:none;outline:none;font-size:14px;font-weight:600;color:var(--text);background:transparent;font-family:inherit" />
              <span id="mapSearchSpinner" style="font-size:14px;display:none">⏳</span>
            </div>
            <div id="mapSuggestions" style="position:absolute;top:100%;left:12px;right:12px;z-index:10001;background:var(--white);border:1px solid var(--glass-border);border-radius:12px;box-shadow:var(--clay-lg);max-height:220px;overflow-y:auto;display:none"></div>
          `;

          // Map container
          const mapDiv = document.createElement('div');
          mapDiv.id = 'mapPickerMap';
          mapDiv.style.cssText = 'flex:1;min-height:0;z-index:1';

          // Bottom bar
          const bottomBar = document.createElement('div');
          bottomBar.style.cssText = 'padding:12px 16px;padding-bottom:max(12px,env(safe-area-inset-bottom));background:var(--glass-bg);backdrop-filter:var(--glass-blur-strong);border-top:1px solid var(--glass-border);flex-shrink:0';
          bottomBar.innerHTML = '<div id="mapPickerInfo" style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;text-align:center">👆 Tap on the map or search above to pin your location</div><button class="btn btn-primary btn-block btn-sm" id="mapPickerConfirm" onclick="window.confirmMapLocation()" disabled>📍 Confirm Location</button>';

          overlay.appendChild(header);
          overlay.appendChild(searchWrap);
          overlay.appendChild(mapDiv);
          overlay.appendChild(bottomBar);
          document.body.appendChild(overlay);

          // Init Leaflet map
          const defaultLat = 17.3850, defaultLng = 78.4867;
          const map = L.map('mapPickerMap').setView([defaultLat, defaultLng], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(map);

          window._mapPickerMap = map;
          window._mapPickerLat = null;
          window._mapPickerLng = null;
          window._mapPickerAddress = '';
          let marker = null;
          let searchTimeout = null;
          window._mapSearchTimeout = null;

          // Try to center on user location
          getCurrentPositionOnce().then(pos => {
            if (pos && pos.lat) map.setView([pos.lat, pos.lng], 15);
          }).catch(() => {});

          // ─── Search with autocomplete ─────────────────────
          const searchInput = document.getElementById('mapSearchInput');
          const suggestionsList = document.getElementById('mapSuggestions');
          const searchSpinner = document.getElementById('mapSearchSpinner');

          searchInput.addEventListener('input', () => {
            const q = searchInput.value.trim();
            if (q.length < 3) {
              suggestionsList.style.display = 'none';
              suggestionsList.innerHTML = '';
              return;
            }
            // Debounce: wait 400ms after user stops typing
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => fetchSuggestions(q), 400);
            window._mapSearchTimeout = searchTimeout;
          });

          // Close suggestions on blur (with delay for click)
          searchInput.addEventListener('blur', () => {
            setTimeout(() => { suggestionsList.style.display = 'none'; }, 200);
          });
          searchInput.addEventListener('focus', () => {
            if (suggestionsList.children.length) suggestionsList.style.display = 'block';
          });

          function fetchSuggestions(query) {
            searchSpinner.style.display = 'inline';
            // Use Nominatim Search API (free, no key needed)
            fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`)
              .then(r => r.json())
              .then(data => {
                searchSpinner.style.display = 'none';
                if (!data || !data.length) {
                  suggestionsList.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-secondary);font-size:13px;font-weight:600">No results found</div>';
                  suggestionsList.style.display = 'block';
                  return;
                }
                suggestionsList.innerHTML = data.map((item, idx) => {
                  // Extract a short display label from the full address
                  const displayLabel = item.display_name ? item.display_name.split(',').slice(0, 3).join(',') : item.display_name;
                  const icon = item.type === 'postcode' ? '📮'
                    : item.type === 'city' || item.type === 'town' || item.type === 'village' ? '🏘️'
                    : item.type === 'road' || item.type === 'street' ? '🛣️'
                    : item.type === 'suburb' || item.type === 'neighbourhood' ? '📍'
                    : '📍';
                  return `<div class="map-suggestion-item" data-idx="${idx}" style="display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;border-bottom:1px solid rgba(0,0,0,0.04);transition:background 0.15s ease"
                    onmouseover="this.style.background='var(--clay-card-hover)'" onmouseout="this.style.background=''" onclick="window.selectMapSuggestion(${idx})">
                    <span style="font-size:18px;flex-shrink:0">${icon}</span>
                    <div style="flex:1;min-width:0">
                      <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.display_name ? item.display_name.split(',').slice(0, 2).join(',') : ''}</div>
                      <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.display_name || ''}</div>
                    </div>
                    <span style="font-size:12px;color:var(--primary);font-weight:700;flex-shrink:0">${(item.lat && item.lon) ? ((item.type === 'postcode' ? '📮' : '') + ' Select') : ''}</span>
                  </div>`;
                }).join('');
                suggestionsList.style.display = 'block';

                // Store results for click handler
                window._mapSearchResults = data;
              })
              .catch(() => {
                searchSpinner.style.display = 'none';
                suggestionsList.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-secondary);font-size:13px">Search failed. Try again.</div>';
                suggestionsList.style.display = 'block';
              });
          }

          // When a suggestion is clicked: update map + marker + address
          window.selectMapSuggestion = (idx) => {
            const results = window._mapSearchResults;
            if (!results || !results[idx]) return;
            const item = results[idx];
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);
            if (isNaN(lat) || isNaN(lng)) return;

            // Hide suggestions
            suggestionsList.style.display = 'none';
            searchInput.value = item.display_name ? item.display_name.split(',').slice(0, 2).join(',') : '';

            // Update state
            window._mapPickerLat = lat;
            window._mapPickerLng = lng;
            window._mapPickerAddress = item.display_name || '';

            // Center map and place marker
            map.setView([lat, lng], 16);
            if (marker) map.removeLayer(marker);
            marker = L.marker([lat, lng], { draggable: true }).addTo(map);
            marker.on('dragend', () => {
              const pos = marker.getLatLng();
              window._mapPickerLat = pos.lat;
              window._mapPickerLng = pos.lng;
              reverseGeocode(pos.lat, pos.lng);
            });

            // Enable confirm button
            document.getElementById('mapPickerConfirm').disabled = false;

            // Show address in bottom info
            const info = document.getElementById('mapPickerInfo');
            info.textContent = `📍 ${(item.display_name || '').substring(0, 120)}`;
            info.style.color = 'var(--primary)';
          };

          // Click to place/update marker
          map.on('click', (e) => {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            window._mapPickerLat = lat;
            window._mapPickerLng = lng;

            if (marker) map.removeLayer(marker);
            marker = L.marker([lat, lng], { draggable: true }).addTo(map);
            marker.on('dragend', () => {
              const pos = marker.getLatLng();
              window._mapPickerLat = pos.lat;
              window._mapPickerLng = pos.lng;
              reverseGeocode(pos.lat, pos.lng);
            });

            document.getElementById('mapPickerConfirm').disabled = false;
            reverseGeocode(lat, lng);
          });

          function reverseGeocode(lat, lng) {
            const info = document.getElementById('mapPickerInfo');
            info.textContent = '⏳ Getting address...';
            info.style.color = 'var(--text-secondary)';
            fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`)
              .then(r => r.json())
              .then(data => {
                if (data && data.display_name) {
                  window._mapPickerAddress = data.display_name;
                  info.textContent = `📍 ${data.display_name.substring(0, 120)}`;
                  info.style.color = 'var(--primary)';
                } else {
                  info.textContent = `📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                }
              }).catch(() => {
                info.textContent = `📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
              });
          }

          // Fix Leaflet tile z-index issue
          map.getContainer().style.zIndex = '1';
          // Invalidate size after DOM render
          setTimeout(() => map.invalidateSize(), 100);
        };

        window.confirmMapLocation = () => {
          if (!window._mapPickerLat) { showAlert('Select Location', 'Please tap on the map first'); return; }
          bookingData.location = `${window._mapPickerLat.toFixed(4)}, ${window._mapPickerLng.toFixed(4)}`;
          if (window._mapPickerAddress) {
            const addrEl = document.getElementById('wizardAddress');
            if (addrEl && !addrEl.value.trim()) addrEl.value = window._mapPickerAddress;
          }
          const info = document.getElementById('wizardLocationInfo');
          info.style.display = 'block';
          info.textContent = `📍 Location set from map: ${bookingData.location}`;
          info.style.color = 'var(--primary)';
          Store.set('custLocation', bookingData.location);
          window.closeMapPicker();
        };

        window.closeMapPicker = () => {
          const overlay = document.getElementById('mapPickerOverlay');
          if (overlay) overlay.remove();
          if (window._mapPickerMap) { window._mapPickerMap.remove(); window._mapPickerMap = null; }
          if (window._mapSearchTimeout) { clearTimeout(window._mapSearchTimeout); window._mapSearchTimeout = null; }
        };

        // ─── Schedule Mode (Step 7) ───────────────────────
        function initWizardSchedulePicker() {
          const dateRow = document.getElementById('wizardDateRow');
          const slotsGrid = document.getElementById('wizardSlotsGrid');
          if (!dateRow || !slotsGrid) return;
          
          // Only populate if not already done
          if (dateRow.children.length > 0) return;

          const today = new Date();
          const dates = [];
          for (let i = 0; i < 14; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            dates.push(d);
          }
          
          dateRow.innerHTML = dates.map((d, i) => {
            const isToday = i === 0;
            return `
              <div class="date-card" style="flex-shrink:0;min-width:62px;text-align:center;padding:8px 10px;border-radius:12px;background:var(--clay-card);border:2px solid transparent;cursor:pointer;transition:all 0.2s ease"
                data-date="${d.toISOString()}" onclick="window.wizardSelectDate('${d.toISOString()}')">
                <div style="font-size:10px;color:var(--text-secondary);font-weight:600">${DAYS[d.getDay()]}</div>
                <div style="font-size:16px;font-weight:900;color:var(--text);margin:2px 0">${d.getDate()}</div>
                <div style="font-size:10px;color:var(--text-secondary)">${MONTHS[d.getMonth()]}</div>
                ${isToday ? '<div style="font-size:8px;color:var(--primary);font-weight:700">Today</div>' : ''}
              </div>
            `;
          }).join('');

          const TIME_SLOTS = [
            '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00',
            '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00'
          ];
          slotsGrid.innerHTML = TIME_SLOTS.map(s =>
            `<button class="slot-btn" style="padding:8px 14px;border-radius:10px;border:2px solid var(--glass-border);background:var(--clay-bg);color:var(--text);font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s ease" data-slot="${s}" onclick="window.wizardSelectSlot('${s}')">🕐 ${s}</button>`
          ).join('');

          // Restore previously selected date/slot if any
          if (bookingData.scheduleDate) {
            const cards = dateRow.querySelectorAll('.date-card');
            cards.forEach(c => {
              if (c.dataset.date === bookingData.scheduleDate) {
                c.style.borderColor = 'var(--primary)';
                c.style.background = 'var(--primary-light)';
              }
            });
          }
          if (bookingData.scheduleSlot) {
            const btns = slotsGrid.querySelectorAll('.slot-btn');
            btns.forEach(b => {
              if (b.dataset.slot === bookingData.scheduleSlot) {
                b.style.borderColor = 'var(--primary)';
                b.style.background = 'var(--primary-light)';
              }
            });
          }
          if (bookingData.scheduleDate && bookingData.scheduleSlot) {
            updateWizardScheduleSummary();
          }
        }

        window.wizardSelectDate = (dateStr) => {
          bookingData.scheduleDate = dateStr;
          const cards = document.querySelectorAll('#wizardDateRow .date-card');
          cards.forEach(c => {
            c.style.borderColor = c.dataset.date === dateStr ? 'var(--primary)' : 'transparent';
            c.style.background = c.dataset.date === dateStr ? 'var(--primary-light)' : 'var(--clay-card)';
          });
          updateWizardScheduleSummary();
        };

        window.wizardSelectSlot = (slot) => {
          bookingData.scheduleSlot = slot;
          const btns = document.querySelectorAll('#wizardSlotsGrid .slot-btn');
          btns.forEach(b => {
            b.style.borderColor = b.dataset.slot === slot ? 'var(--primary)' : 'var(--glass-border)';
            b.style.background = b.dataset.slot === slot ? 'var(--primary-light)' : 'var(--clay-bg)';
          });
          updateWizardScheduleSummary();
        };

        function updateWizardScheduleSummary() {
          const summaryEl = document.getElementById('wizardScheduleSummary');
          if (!summaryEl) return;
          if (bookingData.scheduleDate && bookingData.scheduleSlot) {
            const d = new Date(bookingData.scheduleDate);
            summaryEl.style.display = 'block';
            summaryEl.textContent = `📅 ${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} • 🕐 ${bookingData.scheduleSlot}`;
          } else {
            summaryEl.style.display = 'none';
          }
        }

        window.selectScheduleMode = (mode) => {
          bookingData.scheduleMode = mode;
          const immediateBtn = document.getElementById('scheduleImmediateBtn');
          const laterBtn = document.getElementById('scheduleLaterBtn');
          const pickerSection = document.getElementById('schedulePickerSection');

          if (mode === 'immediate') {
            immediateBtn.style.borderColor = 'var(--primary)';
            immediateBtn.style.background = 'var(--primary-light)';
            laterBtn.style.borderColor = 'var(--glass-border)';
            laterBtn.style.background = 'var(--clay-bg)';
            pickerSection.style.display = 'none';
            // Clear schedule data
            delete bookingData.scheduleDate;
            delete bookingData.scheduleSlot;
          } else {
            laterBtn.style.borderColor = 'var(--primary)';
            laterBtn.style.background = 'var(--primary-light)';
            immediateBtn.style.borderColor = 'var(--glass-border)';
            immediateBtn.style.background = 'var(--clay-bg)';
            pickerSection.style.display = 'block';
            initWizardSchedulePicker();
          }
        };

        // ─── Review & Confirm ─────────────────────────────
        function esc(str) { return str.replace(/[&<>"']/g, function(m) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); }

        function updateReview() {
          const container = document.getElementById('wizardReviewContent');
          if (!container) return;
          const d = bookingData;
          // Determine schedule display
          let scheduleDisplay = '⚡ Immediate';
          if (d.scheduleMode === 'later' && d.scheduleDate && d.scheduleSlot) {
            const sd = new Date(d.scheduleDate);
            scheduleDisplay = `📅 ${DAYS[sd.getDay()]}, ${sd.getDate()} ${MONTHS[sd.getMonth()]} • 🕐 ${d.scheduleSlot}`;
          }
          const items = [
            ['Service', `${d.icon} ${d.service}`],
            ['Brand', d.brand || '—'],
            ['Model', d.model || '—'],
            ['Issue', d.issue || '—'],
            ['Photos', wizardPhotos.length ? `${wizardPhotos.length} photo(s)` : 'None'],
            ['⏰ Schedule', scheduleDisplay],
            ['Address', d.address || '—'],
            ['Location', d.location || '—'],
            ['Pincode', d.pincode || '—'],

          ];
          container.innerHTML = items.map(([label, value]) => `
            <div class="info-row">
              <span class="info-label">${esc(label)}</span>
              <span class="info-value">${esc(value)}</span>
            </div>
          `).join('');
        }

        window.confirmBooking = async () => {
          const svc = selectedService;
          if (!svc) { showAlert('Error', 'Please select a service first'); return; }
          const name = Store.get('custName', 'Customer');
          const phone = Store.get('custPhone', '');
          const pushToken = Store.get('pushToken', '');
          const d = bookingData;
          const brand = d.brand || '';
          const model = d.model || '';
          const issue = d.issue || 'General Service';
          const address = d.address || '';
          const location = d.location || '';
          const pincode = d.pincode || '';


          Store.set('lastBrand', brand);
          Store.set('lastService', svc.name);

          let locStr = location;
          if (!locStr) {
            const pos = await getCurrentPositionOnce();
            locStr = pos && pos.lat ? `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}` : '';
            if (locStr) Store.set('custLocation', locStr);
          }

          // Determine schedule data
          let scheduleMode = d.scheduleMode || 'immediate';
          let scheduleDate = '';
          let scheduleSlot = '';
          let scheduleDateLabel = '';
          if (scheduleMode === 'later' && d.scheduleDate && d.scheduleSlot) {
            const sd = new Date(d.scheduleDate);
            scheduleDate = sd.toISOString().split('T')[0];
            scheduleSlot = d.scheduleSlot;
            scheduleDateLabel = `${DAYS[sd.getDay()]}, ${sd.getDate()} ${MONTHS[sd.getMonth()]}`;
          }

          const order = {
            customerName: name, customerPhone: phone, customerPushToken: pushToken,
            location: locStr, address: address, pincode: pincode,
            service: svc.name, brand: brand, model: model,
            issue: issue, photos: wizardPhotos,
            status: scheduleMode === 'later' ? 'scheduled' : 'pending',
            scheduleMode: scheduleMode,
            scheduleDate: scheduleDate,
            scheduleSlot: scheduleSlot,
            scheduleDateLabel: scheduleDateLabel,
            time: scheduleMode === 'later' ? scheduleSlot : new Date().toLocaleTimeString(),
            createdAt: new Date().toISOString()
          };

          try {
            // Push returns a ThenableReference: key is available synchronously, write is async
            const pushRef = firebase.database().ref('orders').push(order);
            const orderId = pushRef.key;
            await pushRef; // Wait for write to complete so we catch auth/rules errors
            Store.set('lastOrderId', orderId);
            const detail = `${svc.icon} ${svc.name}${brand ? ' • ' + brand : ''}${model ? ' • ' + model : ''}`;
            showAlert('✅ Booking Confirmed!', `${detail}\n\nTrack your order?`, [
              { text: 'Track Now', onPress: () => Router.navigate('tracking') },
              { text: '💬 Chat', onPress: () => Router.navigate('chat', { orderId, role: 'cust', customerName: name }) },
              { text: 'Later' }
            ]);
            window.closeWizard();
          } catch (e) {
            console.error('Booking error:', e);
            showAlert('❌ Booking Failed', 'Could not save order to Firebase.\n\nError: ' + (e.message || 'Database rules may be blocking writes. Check Firebase Console → Realtime Database → Rules'));
          }
        };

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

        // ─── Filter Home (main page search) ────────────────
        window.filterHome = (e) => {
          const q = e.target.value.toLowerCase().trim();
          document.querySelectorAll('.bento-tile').forEach(c => {
            const cName = c.querySelector('.bento-tile-title')?.textContent?.toLowerCase() || '';
            c.style.display = (!q || cName.includes(q)) ? '' : 'none';
          });
        };

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

        // ─── GPS & Location ───────────────────────────────
        startGPS((lat, lng) => {
          const locStr = lat ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : '';
          const locEl = document.getElementById('homeLoc');
          if (locEl) locEl.textContent = '📍 ' + locStr;
          Store.set('custLocation', locStr);
        });

        return () => {
          stopGPS();
          stopCarouselAuto();
          if (window._activeBookingCleanup) { window._activeBookingCleanup(); delete window._activeBookingCleanup; }
          delete window.toggleSearch;
          delete window.filterHome;
          delete window.callTechHome;
          delete window.bentoTileClick;
          delete window.selectService;
          delete window.closeWizard;
          delete window.goToStep;
          delete window.nextStep;
          delete window.prevStep;
          delete window.wizardSelectBrand;
          delete window.selectIssueChip;
          delete window.handlePhotoUpload;
          delete window.removePhoto;
          delete window.useCurrentLocation;
          delete window.selectOnMap;
          delete window.selectMapSuggestion;
          delete window._mapSearchResults;
          delete window._mapSearchTimeout;
          delete window.confirmMapLocation;
          window.closeMapPicker();
          delete window.closeMapPicker;
          delete window.confirmBooking;
          delete window.carouselNext;
          delete window.carouselPrev;
          delete window.carouselGoTo;
          delete window.selectScheduleMode;
          delete window.wizardSelectDate;
          delete window.wizardSelectSlot;
        };
      }
    };
  }
});
