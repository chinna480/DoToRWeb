// Services Screen - Full list of all 12 services with search
Router.register('services', {
  render() {
    const ALL_SERVICES = [
      { id: 'mobile',   icon: '📱',    name: 'Mobile Repair' },
      { id: 'laptop',   icon: '💻',    name: 'Laptop & PC Repair' },
      { id: 'tv',       icon: '📺',    name: 'TV Repair' },
      { id: 'ac',       icon: '❄️',    name: 'AC Service & Repair' },
      { id: 'fridge',   icon: '🧊',    name: 'Refrigerator Repair' },
      { id: 'washing',  icon: '🧺',    name: 'Washing Machine Repair' },
      { id: 'electric', icon: '🔌',    name: 'Electrician Services' },
      { id: 'plumbing', icon: '🚰',    name: 'Plumbing Services' },
      { id: 'cctv',     icon: '📡',    name: 'CCTV Installation & Service' },
      { id: 'wifi',     icon: '🌐',    name: 'Wi-Fi Router Setup' },
      { id: 'ro',       icon: '💧',    name: 'RO Water Purifier Service' },
      { id: 'inverter', icon: '🔋',    name: 'Inverter & UPS Service' },
    ];

    return {
      html: `
        <div class="screen">
          <!-- Header -->
          <div class="header header-dark">
            <button class="header-back" onclick="Router.navigate('home')">←</button>
            <span class="header-title">🔧 All Services</span>
            <div style="width:40px"></div>
          </div>

          <!-- Search bar -->
          <div class="search-bar" style="margin:15px">
            <span style="font-size:16px">🔍</span>
            <input class="form-input" id="servicesSearch" placeholder="Search services..." oninput="window.filterServicesPage(event)" />
          </div>

          <!-- Services Grid -->
          <div class="service-grid" id="servicesGrid">
            ${ALL_SERVICES.map(s => `
              <div class="service-card" data-id="${s.id}" onclick="window.selectServiceFromPage('${s.id}')">
                <span class="service-card-icon">${s.icon}</span>
                <div class="service-card-name">${s.name}</div>
                <div class="service-card-sub">Book Now</div>
              </div>
            `).join('')}
          </div>

          <div style="height:40px"></div>
        </div>
      `,
      init() {
        // Filter services on search
        window.filterServicesPage = (e) => {
          const q = e.target.value.toLowerCase().trim();
          document.querySelectorAll('#servicesGrid .service-card').forEach(c => {
            const name = c.querySelector('.service-card-name')?.textContent?.toLowerCase() || '';
            c.style.display = (!q || name.includes(q)) ? '' : 'none';
          });
        };

        // Select a service → navigate to home to start booking
        window.selectServiceFromPage = (id) => {
          Router.navigate('home', { service: id });
        };

        return () => {
          delete window.filterServicesPage;
          delete window.selectServiceFromPage;
        };
      }
    };
  }
});
