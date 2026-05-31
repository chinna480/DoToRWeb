// Schedule Screen - Book appointment or submit directly
const TIME_SLOTS = [
  '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00',
  '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00'
];
const PHONE_BRANDS = ['iPhone', 'Samsung', 'OnePlus', 'Redmi', 'Vivo', 'Oppo', 'Realme', 'Nokia'];
const LAPTOP_BRANDS = ['Dell', 'HP', 'Lenovo', 'MacBook', 'Asus', 'Acer', 'MSI', 'Sony'];
const PHONE_REPAIRS = ['Screen Replacement', 'Battery Replacement', 'Charging Port', 'Speaker Issue', 'Camera Repair', 'Water Damage', 'Back Panel', 'Software Issue'];
const LAPTOP_REPAIRS = ['Screen Replacement', 'Battery Replacement', 'Keyboard Repair', 'Charging Port', 'RAM Upgrade', 'Hard Disk', 'Overheating', 'Software Issue'];

Router.register('schedule', {
  render() {
    const getAppointmentTime = (date, slot) => {
      const startHour = parseInt(slot.split(' - ')[0].split(':')[0], 10);
      const startMin = parseInt(slot.split(' - ')[0].split(':')[1], 10);
      const t = new Date(date);
      t.setHours(startHour, startMin, 0, 0);
      return t.getTime();
    };

    // Generate next 14 days
    const today = new Date();
    const dates = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    const datesHtml = dates.map((d, i) => {
      return `
        <div class="date-card" data-date="${d.toISOString()}" onclick="window.selectDate('${d.toISOString()}')">
          <div class="date-day">${DAYS[d.getDay()]}</div>
          <div class="date-num">${d.getDate()}</div>
          <div class="date-month">${MONTHS[d.getMonth()]}</div>
        </div>
      `;
    }).join('');

    return {
      html: `
        <div class="screen">
          <div class="header header-dark">
            <button class="header-back" onclick="Router.navigate('home')">←</button>
            <span class="header-title">📅 Schedule Appointment</span>
            <div style="width:40px"></div>
          </div>

          <!-- STEP 1: SELECT DEVICE -->
          <div class="section-title">Step 1 — Select Device</div>
          <div class="device-grid">
            <div class="device-card" data-device="phone" onclick="window.selectSchedDevice('phone')">
              <span class="device-icon">📱</span>
              <div class="device-name">Phone</div>
            </div>
            <div class="device-card" data-device="laptop" onclick="window.selectSchedDevice('laptop')">
              <span class="device-icon">💻</span>
              <div class="device-name">Laptop</div>
            </div>
          </div>

          <!-- STEP 2: SELECT BRAND -->
          <div id="schedBrandSection" style="display:none">
            <div class="section-title">Step 2 — Select Brand</div>
            <div class="brand-grid" id="schedBrandGrid"></div>
          </div>

          <!-- STEP 3: SELECT REPAIR -->
          <div id="schedRepairSection" style="display:none">
            <div class="section-title">Step 3 — What needs repair? (optional)</div>
            <div class="repair-chip-grid" id="schedRepairChips"></div>
          </div>

          <!-- STEP 4: DESCRIBE ISSUE -->
          <div id="schedDescSection" style="display:none">
            <div class="section-title">Step 4 — Describe the Issue</div>
            <div class="desc-box">
              <div class="desc-label">📝 Tell us what's wrong (so technician knows what to bring)</div>
              <textarea id="schedDescription" class="form-textarea" rows="3" placeholder="e.g. Screen cracked, phone not charging, battery draining fast..."></textarea>
            </div>

            <!-- STEP 5: UPLOAD PHOTOS -->
            <div class="section-title">Step 5 — Upload Photos (optional)</div>
            <div class="desc-box">
              <div class="img-upload-row">
                <input type="file" id="schedFileInput" accept="image/*" multiple style="display:none" />
                <button class="img-upload-btn" onclick="window.schedPickGallery()">
                  <span style="font-size:28px">🖼️</span>
                  <span class="img-upload-label">Gallery</span>
                </button>
                <button class="img-upload-btn" onclick="window.schedPickCamera()">
                  <span style="font-size:28px">📷</span>
                  <span class="img-upload-label">Camera</span>
                </button>
              </div>
              <div id="schedImgPreview" class="img-preview-row" style="display:none"></div>
              <div id="schedImgCount" class="img-count-text"></div>
            </div>

            <!-- ACTION BUTTONS -->
            <div class="section-title">Ready to submit?</div>
            <div class="sched-action-row">
              <button class="sched-submit-btn" onclick="window.schedSubmitDirectly()">
                <span style="font-size:28px">📋</span>
                <span class="sched-action-title">Submit Directly</span>
                <span class="sched-action-sub">Available now — send to technicians</span>
              </button>
              <button class="sched-appt-btn" onclick="window.schedShowDateTime()">
                <span style="font-size:28px">📅</span>
                <span class="sched-action-title">Book Appointment</span>
                <span class="sched-action-sub">Choose date & time instead</span>
              </button>
            </div>
          </div>

          <!-- DATE / TIME SECTION (shown after tapping Book Appointment) -->
          <div id="schedDateTimeSection" style="display:none">
            <div class="section-title">Step 6 — Select Date</div>
            <div class="date-row">${datesHtml}</div>
            <div id="schedTimeSlotSection" style="display:none">
              <div class="section-title">Select Time Slot</div>
              <div class="slots-grid" id="schedSlotsGrid">
                ${TIME_SLOTS.map(s => `<button class="slot-btn" data-slot="${s}" onclick="window.schedSelectSlot('${s}')">🕐 ${s}</button>`).join('')}
              </div>
            </div>
            <div id="schedSummarySection" style="display:none">
              <div class="summary-card">
                <div class="summary-title">📋 Appointment Summary</div>
                <div class="summary-row"><span class="summary-label">Device</span><span class="summary-value" id="schedSummaryDevice">-</span></div>
                <div class="summary-row"><span class="summary-label">Brand</span><span class="summary-value" id="schedSummaryBrand">-</span></div>
                <div class="summary-row"><span class="summary-label">Repair</span><span class="summary-value" id="schedSummaryRepair">-</span></div>
                <div class="summary-row" id="schedSummaryIssueRow" style="display:none"><span class="summary-label">Issue</span><span class="summary-value" id="schedSummaryIssue">-</span></div>
                <div class="summary-row" id="schedSummaryPhotosRow" style="display:none"><span class="summary-label">Photos</span><span class="summary-value" id="schedSummaryPhotos">-</span></div>
                <div class="summary-row"><span class="summary-label">Date</span><span class="summary-value" id="schedSummaryDate">-</span></div>
                <div class="summary-row"><span class="summary-label">Time</span><span class="summary-value" id="schedSummaryTime">-</span></div>
                <div class="summary-row"><span class="summary-label">Customer</span><span class="summary-value" id="schedSummaryCust">${Store.get('custName', 'Customer')}</span></div>
              </div>
              <button class="btn btn-primary btn-block" style="margin:0 15px;width:calc(100% - 30px)" onclick="window.schedBookAppointment()">📅 Book Appointment →</button>
            </div>
          </div>

          <div style="height:40px"></div>
        </div>
      `,
      init() {
        let selectedDevice = null;
        let selectedBrand = null;
        let selectedRepair = null;
        let selectedDate = null;
        let selectedSlot = null;
        let schedImages = [];
        const custName = Store.get('custName', 'Customer');
        const custPhone = Store.get('custPhone', '');
        const custPushToken = Store.get('pushToken', '');
        let reminderTimeoutId = null;

        // ── Helper to refresh repair chips when brand/device changes ──
        function renderRepairChips() {
          const chipsEl = document.getElementById('schedRepairChips');
          if (!chipsEl) return;
          const repairs = selectedDevice === 'phone' ? PHONE_REPAIRS : LAPTOP_REPAIRS;
          chipsEl.innerHTML = repairs.map(r => `
            <span class="repair-chip${selectedRepair === r ? ' active' : ''}" data-repair="${r}" onclick="window.schedSelectRepair('${r}')">${r}</span>
          `).join('');
        }

        window.selectSchedDevice = (type) => {
          selectedDevice = type;
          selectedBrand = null;
          selectedRepair = null;
          document.querySelectorAll('.device-card').forEach(c => c.classList.remove('active'));
          document.querySelector(`.device-card[data-device="${type}"]`).classList.add('active');
          const brands = type === 'phone' ? PHONE_BRANDS : LAPTOP_BRANDS;
          const brandGrid = document.getElementById('schedBrandGrid');
          brandGrid.innerHTML = brands.map(b => `
            <div class="brand-card" data-brand="${b}" onclick="window.schedSelectBrand('${b}')">
              <span class="device-icon">${type === 'phone' ? '📱' : '💻'}</span>
              <div class="device-name">${b}</div>
            </div>
          `).join('');
          document.getElementById('schedBrandSection').style.display = 'block';
          document.getElementById('schedRepairSection').style.display = 'none';
          document.getElementById('schedDescSection').style.display = 'none';
          document.getElementById('schedDateTimeSection').style.display = 'none';
        };

        window.schedSelectBrand = (brand) => {
          selectedBrand = brand;
          selectedRepair = null;
          document.querySelectorAll('.brand-card').forEach(c => c.classList.remove('active'));
          document.querySelector(`.brand-card[data-brand="${brand}"]`).classList.add('active');
          document.getElementById('schedRepairSection').style.display = 'block';
          renderRepairChips();
          document.getElementById('schedDescSection').style.display = 'block';
          document.getElementById('schedDateTimeSection').style.display = 'none';
        };

        window.schedSelectRepair = (repair) => {
          selectedRepair = selectedRepair === repair ? null : repair;
          renderRepairChips();
        };

        // ── Image Upload ──
        window.schedPickGallery = () => {
          const input = document.getElementById('schedFileInput');
          input.value = '';
          input.accept = 'image/*';
          input.multiple = true;
          input.click();
        };

        window.schedPickCamera = () => {
          const input = document.getElementById('schedFileInput');
          input.value = '';
          input.accept = 'image/*';
          input.multiple = false;
          input.click();
        };

        document.getElementById('schedFileInput').addEventListener('change', (e) => {
          const files = Array.from(e.target.files);
          files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              schedImages.push(ev.target.result);
              renderSchedImages();
            };
            reader.readAsDataURL(file);
          });
        });

        function renderSchedImages() {
          const preview = document.getElementById('schedImgPreview');
          const count = document.getElementById('schedImgCount');
          if (schedImages.length === 0) {
            preview.style.display = 'none';
            count.textContent = '';
            return;
          }
          preview.style.display = 'flex';
          preview.innerHTML = schedImages.map((img, i) => `
            <div class="img-thumb-wrap">
              <img src="${img}" class="img-thumb" />
              <button class="img-remove-btn" onclick="window.schedRemoveImage(${i})">✕</button>
            </div>
          `).join('');
          count.textContent = schedImages.length + ' photo' + (schedImages.length > 1 ? 's' : '') + ' selected';
        }

        window.schedRemoveImage = (idx) => {
          schedImages.splice(idx, 1);
          renderSchedImages();
        };

        // ── Submit Directly ──
        window.schedSubmitDirectly = () => {
          const repair = selectedRepair || 'General repair';
          const desc = document.getElementById('schedDescription')?.value?.trim() || '';
          const name = Store.get('custName', 'Customer');
          const loc = Store.get('custLocation', 'Your Location');
          const phone = Store.get('custPhone', '');
          const pincode = Store.get('custPincode', '');
          const pushToken = Store.get('pushToken', '');

          const order = {
            customerName: name,
            customerPhone: phone,
            customerPushToken: pushToken,
            location: loc,
            pincode,
            brand: selectedBrand,
            device: selectedDevice,
            repair,
            description: desc,
            images: schedImages.length > 0 ? schedImages : null,
            status: 'pending',
            time: new Date().toLocaleTimeString(),
            fromAppointment: true,
          };

          try {
            const newRef = firebase.database().ref('orders').push(order);
            const orderId = newRef.key;
            Store.set('lastOrderId', orderId);

            showAlert('✅ Order Submitted!', `Brand: ${selectedBrand}\nRepair: ${repair}\n\nTrack your technician?`, [
              { text: 'Track Now', onPress: () => Router.navigate('tracking') },
              { text: '💬 Chat', onPress: () => Router.navigate('chat', { orderId, role: 'cust', customerName: name, techName: '' }) },
              { text: 'Later', onPress: () => Router.navigate('home') }
            ]);
          } catch (e) {
            showAlert('Error', 'Failed to submit order. Try again.');
          }
        };

        // ── Show Date/Time Section ──
        window.schedShowDateTime = () => {
          document.getElementById('schedDateTimeSection').style.display = 'block';
          document.getElementById('schedDateTimeSection').scrollIntoView({ behavior: 'smooth' });
        };

        window.selectDate = (dateStr) => {
          selectedDate = new Date(dateStr);
          document.querySelectorAll('.date-card').forEach(c => c.classList.remove('active'));
          document.querySelector(`.date-card[data-date="${dateStr}"]`).classList.add('active');
          selectedSlot = null;
          document.querySelectorAll('.slot-btn').forEach(s => s.classList.remove('active'));
          document.getElementById('schedTimeSlotSection').style.display = 'block';
          document.getElementById('schedSummarySection').style.display = 'none';
        };

        window.schedSelectSlot = (slot) => {
          selectedSlot = slot;
          document.querySelectorAll('.slot-btn').forEach(s => s.classList.remove('active'));
          document.querySelector(`.slot-btn[data-slot="${slot}"]`).classList.add('active');

          // Update summary
          const repair = selectedRepair || 'Not specified';
          const desc = document.getElementById('schedDescription')?.value?.trim() || '';
          document.getElementById('schedSummaryDevice').textContent = selectedDevice === 'phone' ? '📱 Phone' : '💻 Laptop';
          document.getElementById('schedSummaryBrand').textContent = selectedBrand;
          document.getElementById('schedSummaryRepair').textContent = repair;
          document.getElementById('schedSummaryDate').textContent = `${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}`;
          document.getElementById('schedSummaryTime').textContent = slot;

          if (desc) {
            document.getElementById('schedSummaryIssueRow').style.display = 'flex';
            document.getElementById('schedSummaryIssue').textContent = desc;
          } else {
            document.getElementById('schedSummaryIssueRow').style.display = 'none';
          }

          if (schedImages.length > 0) {
            document.getElementById('schedSummaryPhotosRow').style.display = 'flex';
            document.getElementById('schedSummaryPhotos').textContent = schedImages.length + ' photo' + (schedImages.length > 1 ? 's' : '');
          } else {
            document.getElementById('schedSummaryPhotosRow').style.display = 'none';
          }

          document.getElementById('schedSummarySection').style.display = 'block';
        };

        // ── Reminder sound ──
        function playReminderSound() {
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 660;
            osc.frequency.linearRampToValueAtTime(1100, ctx.currentTime + 0.8);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 1);
          } catch (e) {}
        }

        function scheduleWebReminder(appointmentTime, slotLabel) {
          const remindAt = appointmentTime - 15 * 60 * 1000;
          const now = Date.now();

          if (remindAt > now) {
            const delay = remindAt - now;
            reminderTimeoutId = setTimeout(() => {
              if ('Notification' in window && Notification.permission === 'granted') {
                const notif = new Notification('⏰ Appointment Reminder', {
                  body: `Your ${selectedBrand} appointment at ${slotLabel} is in 15 minutes!`,
                  icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📅</text></svg>',
                  tag: 'appt-reminder-15',
                  requireInteraction: true,
                });
                notif.onclick = () => { window.focus(); notif.close(); };
              }
              playReminderSound();
              sessionStorage.setItem('apptReminded15', appointmentTime.toString());
            }, delay);
          }

          if (appointmentTime > now) {
            const delay2 = appointmentTime - now;
            setTimeout(() => {
              if ('Notification' in window && Notification.permission === 'granted') {
                const notif = new Notification('🔔 Appointment Time!', {
                  body: `Your ${selectedBrand} appointment at ${slotLabel} is starting now!`,
                  icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📅</text></svg>',
                  tag: 'appt-reminder-now',
                  requireInteraction: true,
                });
                notif.onclick = () => { window.focus(); notif.close(); };
              }
              playReminderSound();
            }, delay2);
          }
        }

        // ── Book Appointment ──
        window.schedBookAppointment = () => {
          if (!selectedDate || !selectedSlot) return;
          const appointmentTime = getAppointmentTime(selectedDate, selectedSlot);
          const custLocation = Store.get('custLocation', '');
          const desc = document.getElementById('schedDescription')?.value?.trim() || '';
          const repair = selectedRepair || 'Not specified';

          const appointment = {
            customerName: custName,
            customerPhone: custPhone,
            device: selectedDevice,
            brand: selectedBrand,
            repair,
            description: desc,
            images: schedImages.length > 0 ? schedImages : null,
            date: selectedDate.toISOString().split('T')[0],
            dateLabel: `${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}`,
            timeSlot: selectedSlot,
            appointmentTime,
            reminderSent: false,
            status: 'scheduled',
            createdAt: Date.now(),
          };

          firebase.database().ref('appointments').push(appointment).then(ref => {
            Store.set('lastAppointmentId', ref.key);
            const custPincode = Store.get('custPincode', '');
            firebase.database().ref('orders').push({
              customerName: custName,
              customerPhone: custPhone,
              customerPushToken: custPushToken,
              location: custLocation,
              pincode: custPincode,
              brand: selectedBrand,
              device: selectedDevice,
              repair: `Appointment: ${repair}`,
              description: desc,
              images: schedImages.length > 0 ? schedImages : null,
              status: 'pending',
              time: selectedSlot,
              appointmentTime,
              reminderSent: false,
              isAppointment: true,
            });

            if ('Notification' in window && Notification.permission !== 'granted') {
              Notification.requestPermission().catch(() => {});
            }
            scheduleWebReminder(appointmentTime, selectedSlot);

            showAlert('✅ Appointment Booked!',
              `Device: ${selectedDevice}\nBrand: ${selectedBrand}\nDate: ${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}\nTime: ${selectedSlot}`,
              [{ text: 'OK', onPress: () => Router.navigate('home') }]
            );
          }).catch(() => showAlert('Error', 'Failed to book appointment. Try again.'));
        };

        return () => {
          if (reminderTimeoutId) clearTimeout(reminderTimeoutId);
          delete window.selectSchedDevice;
          delete window.schedSelectBrand;
          delete window.schedSelectRepair;
          delete window.schedPickGallery;
          delete window.schedPickCamera;
          delete window.schedRemoveImage;
          delete window.schedSubmitDirectly;
          delete window.schedShowDateTime;
          delete window.selectDate;
          delete window.schedSelectSlot;
          delete window.schedBookAppointment;
        };
      }
    };
  }
});
