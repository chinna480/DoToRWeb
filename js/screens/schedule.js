// Schedule Screen - Book appointment with date/time selection
const TIME_SLOTS = [
  '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00',
  '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00'
];

Router.register('schedule', {
  render() {
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
          <div class="schedule-banner glass">
            <div class="schedule-banner-icon">🕐</div>
            <div>
              <div class="schedule-banner-title">Choose your preferred time</div>
              <div class="schedule-banner-sub">📅 Select date & time slot below</div>
            </div>
          </div>
          <div class="section-title">📅 Select Date</div>
          <div class="date-row">${datesHtml}</div>
          <div id="timeSlotSection" style="display:none">
            <div class="section-title">⏰ Select Time Slot</div>
            <div class="slots-grid" id="slotsGrid">
              ${TIME_SLOTS.map(s => `<button class="slot-btn" data-slot="${s}" onclick="window.selectSlot('${s}')">🕐 ${s}</button>`).join('')}
            </div>
          </div>
          <div id="summarySection" style="display:none">
            <div class="summary-card glass">
              <div class="summary-title">📋 Appointment Summary</div>
              <div class="summary-row"><span class="summary-label">📅 Date</span><span class="summary-value" id="summaryDate">-</span></div>
              <div class="summary-row"><span class="summary-label">⏰ Time</span><span class="summary-value" id="summaryTime">-</span></div>
              <div class="summary-row"><span class="summary-label">👤 Customer</span><span class="summary-value" id="summaryCust">${Store.get('custName', 'Customer')}</span></div>
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

        window.bookAppointment = async () => {
          if (!selectedDate || !selectedSlot) return;
          let custLocation = Store.get('custLocation', '');
          // Get GPS position for more accurate location
          const pos = await getCurrentPositionOnce();
          if (pos && pos.lat) {
            custLocation = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
            Store.set('custLocation', custLocation);
            try { firebase.database().ref('custLocation').set({ lat: pos.lat, lng: pos.lng }); } catch (e) {}
          }
          const appointment = {
            customerName: custName,
            customerPhone: custPhone,
            date: selectedDate.toISOString().split('T')[0],
            dateLabel: `${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}`,
            timeSlot: selectedSlot,
            status: 'pending',
            location: custLocation,
            pincode: '',
            createdAt: Date.now(),
          };
          firebase.database().ref('appointments').push(appointment).then(ref => {
            Store.set('lastAppointmentId', ref.key);
            // Also create an order record
            const dateLabel = `${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}`;
            firebase.database().ref('orders').push({
              customerName: custName,
              customerPhone: custPhone,
              location: custLocation,
              pincode: '',
              brand: 'Scheduled',
              repair: 'Appointment: ' + selectedSlot,
              status: 'pending',
              time: selectedSlot,
              dateLabel: dateLabel,
              isAppointment: true,
            });
            showAlert('✅ Appointment Booked!',
              `Date: ${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}\nTime: ${selectedSlot}\n\nWe'll notify you when your appointment is confirmed.`,
              [{ text: 'OK', onPress: () => Router.navigate('home') }]
            );
          }).catch(() => showAlert('Error', 'Failed to book appointment. Try again.'));
        };

        return () => { delete window.selectDate; delete window.selectSlot; delete window.bookAppointment; };
      }
    };
  }
});
