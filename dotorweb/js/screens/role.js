// Role Selection Screen
Router.register('role', {
  render() {
    return {
      html: `
        <div class="screen role-container">
          <div class="role-brand">🔧 DoToR</div>
          <div class="role-brand-sub">DOOR-TO-DOOR REPAIR</div>
          <div class="role-question">Who are you?</div>
          <button class="role-btn role-btn-customer" onclick="Router.navigate('customer-login')">
            <span class="role-btn-icon">👤</span>
            <span class="role-btn-title">I need Repair</span>
            <span class="role-btn-sub">Customer Login</span>
          </button>
          <button class="role-btn role-btn-tech" onclick="Router.navigate('tech-login')">
            <span class="role-btn-icon">🔧</span>
            <span class="role-btn-title">I am a Technician</span>
            <span class="role-btn-sub">Technician Login</span>
          </button>
        </div>
      `,
      init() { return () => {}; }
    };
  }
});
