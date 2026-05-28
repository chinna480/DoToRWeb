// Schedule Screen - Book appointment with date/time selection
const TIME_SLOTS = [
  '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00',
  '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00'
];

Router.register('schedule', {
  render() {
    // ── Helper: parse appointment time from date + slot to Unix timestamp ──
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
      const isToday = i === 0;
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
          <div class="schedule-banner">
            <div class="schedule-banner-icon">🕐</div>
            <div>
              <div class="schedule-banner-title">Choose your preferred time</div>
              <div class="schedule-banner-sub">Select date & time slot below</div>
            </div>
          </div>
          <div class="section-title">Select Date</div>
          <div class="date-row">${datesHtml}</div>
          <div id="timeSlotSection" style="display:none">
            <div class="section-title">Select Time Slot</div>
            <div class="slots-grid" id="slotsGrid">
              ${TIME_SLOTS.map(s => `<button class="slot-btn" data-slot="${s}" onclick="window.selectSlot('${s}')">🕐 ${s}</button>`).join('')}
            </div>
          </div>
          <div id="summarySection" style="display:none">
            <div class="summary-card">
              <div class="summary-title">📋 Appointment Summary</div>
              <div class="summary-row"><span class="summary-label">Date</span><span class="summary-value" id="summaryDate">-</span></div>
              <div class="summary-row"><span class="summary-label">Time</span><span class="summary-value" id="summaryTime">-</span></div>
              <div class="summary-row"><span class="summary-label">Customer</span><span class="summary-value" id="summaryCust">${Store.get('custName', 'Customer')}</span></div>
            </div>
            <button class="btn btn-primary btn-block" style="margin:0 15px;width:calc(100% - 30px)" onclick="window.bookAppointment()">📅 Book Appointment →</button>
          </div>
          <div style="height:40px"></div>
        </div>
      `,
      init() {
        let selectedDate = null;
        let selectedSlot = null;
        const custName = Store.get('custName', 'Customer');
        const custPhone = Store.get('custPhone', '');
        const custPushToken = Store.get('pushToken', '');
        // ⏰ Load any pending browser reminder timeout IDs from sessionStorage
        let reminderTimeoutId = null;

        window.selectDate = (dateStr) => {
          selectedDate = new Date(dateStr);
          document.querySelectorAll('.date-card').forEach(c => c.classList.remove('active'));
          document.querySelector(`.date-card[data-date="${dateStr}"]`).classList.add('active');
          selectedSlot = null;
          document.querySelectorAll('.slot-btn').forEach(s => s.classList.remove('active'));
          document.getElementById('timeSlotSection').style.display = 'block';
          document.getElementById('summarySection').style.display = 'none';
        };

        window.selectSlot = (slot) => {
          selectedSlot = slot;
          document.querySelectorAll('.slot-btn').forEach(s => s.classList.remove('active'));
          document.querySelector(`.slot-btn[data-slot="${slot}"]`).classList.add('active');
          // Show summary
          document.getElementById('summaryDate').textContent = `${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}`;
          document.getElementById('summaryTime').textContent = slot;
          document.getElementById('summarySection').style.display = 'block';
        };

        // ── Play appointment reminder sound effect ──
        function playReminderSound() {
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            // Pleasant ascending tone
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

        // ── Schedule a browser notification reminder ──
        function scheduleWebReminder(appointmentTime, slotLabel) {
          const remindAt = appointmentTime - 15 * 60 * 1000; // 15 mins before
          const now = Date.now();

          // Reminder 15 mins before
          if (remindAt > now) {
            const delay = remindAt - now;
            reminderTimeoutId = setTimeout(() => {
              if ('Notification' in window && Notification.permission === 'granted') {
                const notif = new Notification('⏰ Appointment Reminder', {
                  body: `Your appointment at ${slotLabel} is in 15 minutes!`,
                  icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📅</text></svg>',
                  tag: 'appt-reminder-15',
                  requireInteraction: true,
                });
                notif.onclick = () => { window.focus(); notif.close(); };
              }
              playReminderSound();
              // Store in sessionStorage so we don't re-schedule on page refresh
              sessionStorage.setItem('apptReminded15', appointmentTime.toString());
            }, delay);
          }

          // Reminder at appointment time
          if (appointmentTime > now) {
            const delay2 = appointmentTime - now;
            setTimeout(() => {
              if ('Notification' in window && Notification.permission === 'granted') {
                const notif = new Notification('🔔 Appointment Time!', {
                  body: `Your appointment at ${slotLabel} is starting now!`,
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

        window.bookAppointment = () => {
          if (!selectedDate || !selectedSlot) return;
          const appointmentTime = getAppointmentTime(selectedDate, selectedSlot);
          const custLocation = Store.get('custLocation', '');
          const appointment = {
            customerName: custName,
            customerPhone: custPhone,
            date: selectedDate.toISOString().split('T')[0],
            dateLabel: `${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}`,
            timeSlot: selectedSlot,
            appointmentTime, // Unix timestamp — enables Cloud Function reminders
            reminderSent: false,
            status: 'scheduled',
            createdAt: Date.now(),
          };
          firebase.database().ref('appointments').push(appointment).then(ref => {
            Store.set('lastAppointmentId', ref.key);
            // Also create an order
            const custPincode = Store.get('custPincode', '');
            firebase.database().ref('orders').push({
              customerName: custName,
              customerPhone: custPhone,
              customerPushToken: custPushToken,
              location: custLocation,
              pincode: custPincode,
              brand: 'Scheduled',
              repair: 'Appointment: ' + selectedSlot,
              status: 'pending',
              time: selectedSlot,
              appointmentTime,
              reminderSent: false,
              isAppointment: true,
            });

            // ── Schedule browser notification reminder ──
            if ('Notification' in window && Notification.permission !== 'granted') {
              Notification.requestPermission().catch(() => {});
            }
            scheduleWebReminder(appointmentTime, selectedSlot);

            showAlert('✅ Appointment Booked!',
              `Date: ${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}\nTime: ${selectedSlot}\n\n✅ You will get a reminder alert 15 minutes before!`,
              [{ text: 'OK', onPress: () => Router.navigate('home') }]
            );
          }).catch(() => showAlert('Error', 'Failed to book appointment. Try again.'));
        };

        return () => {
          if (reminderTimeoutId) clearTimeout(reminderTimeoutId);
          delete window.selectDate; delete window.selectSlot; delete window.bookAppointment;
        };
      }
    };
  }
});
