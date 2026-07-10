// Customer Login Screen — 3-step flow
// Step 1: Phone → Step 2: OTP (demo 123456) → Step 3: Name
Router.register('customer-login', {
  render() {
    return {
      html: `
        <div class="screen">
          <div class="scroll-content">
            <button class="login-back" onclick="Router.navigate('role')">←</button>
            <div class="login-header">
              <div class="login-icon">📱</div>
              <div class="login-title">Get Started</div>
              <div class="login-sub" id="loginStepLabel">Step 1 of 3 — Enter your phone number</div>
            </div>
            <div id="loginStep1" style="display:block">
              <div class="form-group">
                <label class="form-label">Phone Number</label>
                <div class="form-field">
                  <span class="form-icon">🇮🇳 +91</span>
                  <input class="form-input" id="custPhone" placeholder="Enter 10 digit number" type="tel" maxlength="10" />
                </div>
              </div>
              <button class="btn btn-primary btn-block" onclick="window.goToStep2()">Send OTP →</button>
            </div>
            <div id="loginStep2" style="display:none">
              <div class="form-group">
                <label class="form-label">Enter OTP</label>
                <div class="form-field">
                  <span class="form-icon">🔐</span>
                  <input class="form-input" id="custOtp" placeholder="Enter OTP" type="tel" maxlength="6" />
                </div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:8px;text-align:center;font-weight:600">
                  Demo OTP: <strong>123456</strong>
                </div>
              </div>
              <button class="btn btn-primary btn-block" onclick="window.goToStep3()">Verify OTP →</button>
            </div>
            <div id="loginStep3" style="display:none">
              <div class="form-group">
                <label class="form-label">Your Name</label>
                <div class="form-field">
                  <span class="form-icon">👤</span>
                  <input class="form-input" id="custName" placeholder="Enter your full name" type="text" />
                </div>
              </div>
              <button class="btn btn-primary btn-block" onclick="window.completeLogin()">Continue →</button>
            </div>
          </div>
        </div>
      `,
      init() {
        window.goToStep2 = () => {
          const phone = document.getElementById('custPhone').value.trim();
          if (phone.length !== 10) { showAlert('Error', 'Enter valid 10 digit phone number!'); return; }
          Store.set('custPhone', phone);
          document.getElementById('loginStep1').style.display = 'none';
          document.getElementById('loginStep2').style.display = 'block';
          document.getElementById('loginStepLabel').textContent = 'Step 2 of 3 — Verify OTP sent to +91 ' + phone;
        };

        window.goToStep3 = () => {
          const otp = document.getElementById('custOtp').value.trim();
          if (otp !== '123456') { showAlert('Error', 'Invalid OTP — try 123456'); return; }
          document.getElementById('loginStep2').style.display = 'none';
          document.getElementById('loginStep3').style.display = 'block';
          document.getElementById('loginStepLabel').textContent = 'Step 3 of 3 — What should we call you?';
        };

        window.completeLogin = () => {
          const name = document.getElementById('custName').value.trim();
          if (!name) { showAlert('Error', 'Enter your name!'); return; }
          const phone = Store.get('custPhone', '');
          Store.set('userRole', 'customer');
          Store.set('custName', name);
          Store.set('pushToken', 'web-user-' + Date.now());
          // Save to Firebase
          firebase.database().ref('users/' + phone).update({ name, phone, pushToken: Store.get('pushToken') }).catch(() => {});
          Router.navigate('home');
        };

        return () => { delete window.goToStep2; delete window.goToStep3; delete window.completeLogin; };
      }
    };
  }
});
