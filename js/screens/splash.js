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
          <div style="margin-top:30px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();window.splashGoCustomer()" style="min-width:180px">👤 Customer</button>
            <button class="btn btn-dark btn-sm" onclick="event.stopPropagation();window.splashGoTech()" style="min-width:180px">🔧 Technician</button>
          </div>
        </div>
      `,
      init() {
        // Check if user is already logged in with Google (Store + Firebase Auth)
        const googleUser = Store.get('googleUser', null);
        const firebaseUser = firebase.auth().currentUser;
        const isLoggedIn = (googleUser && googleUser.email) || firebaseUser;
        const isTech = Store.get('techInfo', null);

        // If tech is logged in, go to tech dashboard
        if (isTech && isTech.name && isTech.phone) {
          const timer = setTimeout(() => {
            Router.navigate('tech').catch(function(e) {
              console.warn('Splash navigate error:', e);
            });
          }, 1500);
          return () => clearTimeout(timer);
        }

        // If customer is logged in, go to home; else show splash with role buttons
        if (isLoggedIn) {
          const timer = setTimeout(() => {
            Router.navigate('home').catch(function(e) {
              console.warn('Splash navigate error:', e);
            });
          }, 1500);
          return () => clearTimeout(timer);
        }

        // Show role selection after loader animation
        const timer = setTimeout(() => {
          // Animate the loader then show buttons
          const loader = document.querySelector('.splash-loader');
          if (loader) loader.style.opacity = '0.3';
        }, 500);

        window.splashGoCustomer = () => {
          Router.navigate('customer-login').catch(function(e) {
            console.warn('Splash navigate error:', e);
          });
        };

        window.splashGoTech = () => {
          Router.navigate('tech').catch(function(e) {
            console.warn('Splash navigate error:', e);
          });
        };

        return () => {
          clearTimeout(timer);
          delete window.splashGoCustomer;
          delete window.splashGoTech;
        };
      }
    };
  }
});
