// Customer Login Screen — Google Sign-In flow
// Step 1: Google Sign-In → Step 2: Name & Phone collection
Router.register('customer-login', {
  render() {
    // Note: Returning users are redirected by splash.js directly to 'home'
    // This screen only appears for first-time or logged-out users

    return {
      html: `
        <div class="screen">
          <div class="scroll-content">
            <button class="login-back glass" onclick="Router.navigate('splash')">← Back</button>
            <div class="login-header">
              <div class="login-icon">🔧</div>
              <div class="login-title">Welcome to DoToR</div>
              <div class="login-sub" id="loginStepLabel">Sign in with Google to get started</div>
            </div>

            <!-- Step 1: Google Sign-In -->
            <div id="loginStep1" style="display:block">
              <div class="glass" style="padding:30px 20px;margin-top:10px;text-align:center">
                <div style="font-size:60px;margin-bottom:16px">🛠️</div>
                <div style="font-size:15px;font-weight:600;color:var(--text-secondary);margin-bottom:20px;line-height:1.5">
                  One tap to book repairs at your doorstep.<br/>
                  We are the Doctor of your Device 🩺
                </div>
                <button class="google-signin-btn" onclick="window.startGoogleSignIn()">
                  <span class="google-signin-icon">
                    <svg width="22" height="22" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.54 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.87 7.35 2.56 10.78l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                  </span>
                  <span class="google-signin-text">Sign in with Google</span>
                </button>
                <div style="margin-top:20px;font-size:12px;color:var(--text-secondary);font-weight:600">
                  🔒 Your data is safe &amp; secure with Firebase
                </div>
              </div>
            </div>

            <!-- Step 2: Name & Phone -->
            <div id="loginStep2" style="display:none">
              <div class="glass" style="padding:20px;margin-top:10px">
                <div id="googleProfilePreview" style="display:flex;align-items:center;gap:14px;padding:12px 0 16px;border-bottom:1px solid var(--clay-divider);margin-bottom:16px"></div>
                <div class="form-group">
                  <label class="form-label">👤 Full Name</label>
                  <div class="form-field">
                    <span class="form-icon">👤</span>
                    <input class="form-input" id="custName" placeholder="Enter your full name" type="text" />
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">📱 Phone Number</label>
                  <div class="form-field">
                    <span class="form-icon">🇮🇳 +91</span>
                    <input class="form-input" id="custPhone" placeholder="Enter 10 digit number" type="tel" maxlength="10" />
                  </div>
                </div>
                <button class="btn btn-primary btn-block" onclick="window.completeLogin()">Continue →</button>
              </div>
            </div>
          </div>
        </div>
      `,
      init() {
        // ─── Google Sign-In ──────────────────────────────────
        window.startGoogleSignIn = async () => {
          try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');
            // Show loading state
            const label = document.getElementById('loginStepLabel');
            if (label) label.textContent = '⏳ Signing in with Google...';

            const result = await firebase.auth().signInWithPopup(provider);
            const user = result.user;

            if (!user) {
              showAlert('Sign-In Failed', 'Could not get user info from Google. Please try again.');
              if (label) label.textContent = 'Sign in with Google to get started';
              return;
            }

            // Store Google user info
            const googleUser = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || '',
              photoURL: user.photoURL || '',
            };
            Store.set('googleUser', googleUser);

            // Move to step 2 with pre-filled name
            document.getElementById('loginStep1').style.display = 'none';
            document.getElementById('loginStep2').style.display = 'block';
            document.getElementById('loginStepLabel').textContent = '👤 Just a few more details';

            // Pre-fill name from Google profile
            const nameInput = document.getElementById('custName');
            if (nameInput && user.displayName) {
              nameInput.value = user.displayName;
            }

            // Show Google profile preview
            const preview = document.getElementById('googleProfilePreview');
            if (preview) {
              const photoHtml = user.photoURL
                ? `<img src="${user.photoURL}" class="google-profile-photo" />`
                : `<div class="google-profile-photo-placeholder">👤</div>`;
              preview.innerHTML = `
                ${photoHtml}
                <div style="flex:1;min-width:0">
                  <div class="google-profile-email">${user.email || 'No email'}</div>
                  <div class="google-profile-verified">✅ Verified with Google</div>
                </div>
              `;
            }

          } catch (error) {
            console.error('Google Sign-In error:', error);
            let msg = 'Something went wrong. Please try again.';
            if (error.code === 'auth/popup-closed-by-user') {
              msg = 'Sign-in was cancelled. Tap the button to try again.';
            } else if (error.code === 'auth/popup-blocked') {
              msg = 'Popup was blocked. Please allow popups for this site.';
            } else if (error.code === 'auth/unauthorized-domain') {
              msg = 'This domain is not authorized for Google Sign-In. Please add it in Firebase Console → Authentication → Sign-in method → Authorized domains.';
            }
            showAlert('Sign-In Error', msg);
            const label = document.getElementById('loginStepLabel');
            if (label) label.textContent = 'Sign in with Google to get started';
          }
        };

        // ─── Complete Login ──────────────────────────────────
        window.completeLogin = () => {
          const name = document.getElementById('custName').value.trim();
          const phone = document.getElementById('custPhone').value.trim();
          const googleUser = Store.get('googleUser', {});

          if (!name) { showAlert('Error', 'Enter your full name!'); return; }
          if (phone.length !== 10) { showAlert('Error', 'Enter valid 10 digit phone number!'); return; }

          // Save user data
          Store.set('userRole', 'customer');
          Store.set('custName', name);
          Store.set('custPhone', phone);
          Store.set('pushToken', 'web-user-' + Date.now());

          // Save to Firebase Realtime Database
          const userData = {
            name,
            phone,
            email: googleUser.email || '',
            uid: googleUser.uid || '',
            photoURL: googleUser.photoURL || '',
            pushToken: Store.get('pushToken'),
            createdAt: new Date().toISOString()
          };
          firebase.database().ref('users/' + phone).update(userData).catch(err => {
            console.error('Failed to save user to Firebase:', err.message);
          });

          // Navigate to home
          Router.navigate('home');
        };

        return () => {
          delete window.startGoogleSignIn;
          delete window.completeLogin;
        };
      }
    };
  }
});
