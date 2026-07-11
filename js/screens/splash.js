// Splash Screen - Bento Glass
Router.register('splash', {
  render() {
    return {
      html: `
        <div class="screen splash-container">
          <div class="splash-logo"><span class="splash-emoji">🔧</span></div>
          <div class="splash-brand">DoToR</div>
          <div class="splash-caption">We are the Doctor of your Device 🩺</div>
          <div class="splash-loader"><div class="splash-loader-bar"></div></div>
          <div class="splash-footer">🏠 Door-to-Door Repair Service</div>
        </div>
      `,
      init() {
        // Check if user is already logged in with Google (Store + Firebase Auth)
        const googleUser = Store.get('googleUser', null);
        const firebaseUser = firebase.auth().currentUser;
        const isLoggedIn = (googleUser && googleUser.email) || firebaseUser;
        const targetScreen = isLoggedIn ? 'home' : 'customer-login';

        const timer = setTimeout(() => {
          Router.navigate(targetScreen).catch(function(e) {
            console.warn('Splash navigate error:', e);
          });
        }, 2500);

        return () => clearTimeout(timer);
      }
    };
  }
});
