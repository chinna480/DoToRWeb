// Role Selection Screen (Customer only)
Router.register('role', {
  render() {
    return {
      html: `
        <div class="screen role-container">
          <div class="role-brand">🔧 DoToR</div>
          <div class="role-brand-sub">DOOR-TO-DOOR REPAIR</div>
          <div style="margin: 30px 0">
            <button class="role-btn role-btn-customer" onclick="Router.navigate('customer-login')">
              <span class="role-btn-icon">👤</span>
              <span class="role-btn-title">Get Started</span>
              <span class="role-btn-sub">Book a Repair</span>
            </button>
          </div>
        </div>
      `,
      init() { return () => {}; }
    };
  }
});
