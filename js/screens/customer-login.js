// Customer Login Screen
Router.register('customer-login', {
  render() {
    return {
      html: `
        <div class="screen">
          <div class="scroll-content">
            <button class="login-back" onclick="Router.navigate('role')">←</button>
            <div class="login-header">
              <div class="login-icon">👤</div>
              <div class="login-title">Customer Login</div>
              <div class="login-sub">Enter your details to continue</div>
            </div>
            <div id="cust-login-form">
              <div class="form-group">
                <label class="form-label">Full Name</label>
                <div class="form-field">
                  <span class="form-icon">👤</span>
                  <input class="form-input" id="custName" placeholder="Enter your full name" type="text" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Email ID</label>
                <div class="form-field">
                  <span class="form-icon">📧</span>
                  <input class="form-input" id="custEmail" placeholder="Enter your email" type="email" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Phone Number</label>
                <div class="form-field">
                  <span class="form-icon">📱</span>
                  <input class="form-input" id="custPhone" placeholder="Enter 10 digit number" type="tel" maxlength="10" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Your Location</label>
                <div class="form-field">
                  <span class="form-icon">📍</span>
                  <input class="form-input" id="custLocation" placeholder="Enter your area" type="text" />
                </div>
              </div>
              <div id="otpSection" style="display:none">
                <div class="form-group">
                  <label class="form-label">OTP</label>
                  <div class="form-field">
                    <span class="form-icon">🔐</span>
                    <input class="form-input" id="custOtp" placeholder="Enter OTP" type="tel" maxlength="6" />
                  </div>
                </div>
                <button class="btn btn-primary btn-block" onclick="window.verifyCustOtp()">Verify OTP →</button>
              </div>
              <button class="btn btn-primary btn-block" id="sendOtpBtn" onclick="window.sendCustOtp()">Send OTP →</button>
            </div>
            <div class="login-switch">
              Are you a Technician? <span class="login-link" onclick="Router.navigate('tech-login')">Login here</span>
            </div>
          </div>
        </div>
      `,
      init() {
        window.sendCustOtp = () => {
          const name = document.getElementById('custName').value.trim();
          const email = document.getElementById('custEmail').value.trim();
          const phone = document.getElementById('custPhone').value.trim();
          const location = document.getElementById('custLocation').value.trim();
          if (!name) { showAlert('Error', 'Enter your name!'); return; }
          if (!email) { showAlert('Error', 'Enter your email!'); return; }
          if (phone.length !== 10) { showAlert('Error', 'Enter valid 10 digit number!'); return; }
          if (!location) { showAlert('Error', 'Enter your location!'); return; }
          document.getElementById('otpSection').style.display = 'block';
          document.getElementById('sendOtpBtn').style.display = 'none';
          showAlert('OTP Sent', 'Demo OTP is: 123456');
        };
        window.verifyCustOtp = () => {
          const otp = document.getElementById('custOtp').value.trim();
          const name = document.getElementById('custName').value.trim();
          const email = document.getElementById('custEmail').value.trim();
          const phone = document.getElementById('custPhone').value.trim();
          const location = document.getElementById('custLocation').value.trim();
          if (otp !== '123456') { showAlert('Error', 'Invalid OTP'); return; }
          Store.set('userRole', 'customer');
          Store.set('custName', name);
          Store.set('custEmail', email);
          Store.set('custPhone', phone);
          Store.set('custLocation', location);
          // Save push token placeholder
          Store.set('pushToken', 'web-user-' + Date.now());
          // Save to Firebase
          firebase.database().ref('users/' + phone).update({ name, phone, location, pushToken: Store.get('pushToken') });
          Router.navigate('home');
        };
        return () => { delete window.sendCustOtp; delete window.verifyCustOtp; };
      }
    };
  }
});
