// Splash Screen
Router.register('splash', {
  render() {
    return {
      html: `
        <div class="screen splash-container">
          <div class="splash-logo"><span class="splash-emoji">🔧</span></div>
          <div class="splash-brand">DoToR</div>
          <div class="splash-caption">We are the Doctor of your Device</div>
          <div class="splash-loader"><div class="splash-loader-bar"></div></div>
          <div class="splash-footer">Door-to-Door Repair Service</div>
        </div>
      `,
      init() {
        const timer = setTimeout(() => {
          Router.navigate('role').catch(function(e) {
            console.warn('Splash navigate error:', e);
          });
        }, 3000);
        return () => clearTimeout(timer);
      }
    };
  }
});
