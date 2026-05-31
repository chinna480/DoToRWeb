// Customer Login Screen

// Simulated Aadhaar data for DigiLocker demo
const DL_MOCK_AADHAAR = {
  '123412341234': { name: 'Rahul Sharma', dob: '15/08/1995', gender: 'Male', address: '42, MG Road, Indiranagar, Bangalore - 560038', phone: '9876543210' },
  '567856785678': { name: 'Priya Patel', dob: '22/03/1998', gender: 'Female', address: '7, Lake View Apartments, Koramangala, Bangalore - 560034', phone: '8765432109' },
  '901290129012': { name: 'Amit Kumar', dob: '10/11/1992', gender: 'Male', address: '15, Gandhi Nagar, Hyderabad - 500080', phone: '9988776655' },
};

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
                <div class="form-field" style="position:relative">
                  <span class="form-icon">📍</span>
                  <input class="form-input" id="custLocation" placeholder="Search your area..." type="text" autocomplete="off" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Pincode</label>
                <div class="form-field">
                  <span class="form-icon">📮</span>
                  <input class="form-input" id="custPincode" placeholder="Enter 6-digit pincode" type="tel" maxlength="6" />
                </div>
              </div>

              <!-- 🔐 DIGILOCKER SECURITY SECTION -->
              <div class="security-section">
                <div class="security-header">
                  <span class="security-header-icon">🛡️</span>
                  <span class="security-header-title">Security Verification</span>
                </div>
                <button class="digilocker-btn" onclick="window.openDigiLocker('customer')">
                  <span class="digilocker-btn-icon">🔐</span>
                  <span>Verify via DigiLocker</span>
                </button>
                <div id="custDigiBadge" style="display:none" class="digilocker-verified-badge">
                  <span class="digilocker-verified-badge-icon">✅</span>
                  <span class="digilocker-verified-badge-text">DigiLocker Verified</span>
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

        <!-- DigiLocker Modal -->
        <div id="digilockerModal" class="digilocker-overlay" style="display:none" onclick="if(event.target===this)closeDigiLocker()">
          <div class="digilocker-modal" id="digilockerModalContent">
            <button class="digilocker-close" onclick="closeDigiLocker()">✕</button>
            <div id="digilockerStepContainer">
              <!-- Rendered by JS -->
            </div>
          </div>
        </div>
      `,
      init() {
        let dlStep = 'consent'; // consent → aadhaar → verifying → verified
        let dlAadhaar = '';
        let dlData = null;

        // Initialize Google Places Autocomplete for location
        const initPlacesAutocomplete = (inputId) => {
          const input = document.getElementById(inputId);
          if (!input || typeof google === 'undefined' || !google.maps?.places) return;
          const autocomplete = new google.maps.places.Autocomplete(input, {
            types: ['geocode', 'establishment'],
            componentRestrictions: { country: 'in' },
            fields: ['formatted_address', 'name', 'address_components'],
          });
          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place && place.formatted_address) {
              input.value = place.formatted_address;
            }
          });
        };
        window.GOOGLE_MAPS_LOADED.then(() => {
          initPlacesAutocomplete('custLocation');
        }).catch(() => {});

        // ─── DigiLocker Functions ───
        window.openDigiLocker = (role) => {
          dlStep = 'consent';
          dlAadhaar = '';
          dlData = null;
          document.getElementById('digilockerModal').style.display = 'flex';
          renderDigiLockerStep();
        };

        window.closeDigiLocker = () => {
          document.getElementById('digilockerModal').style.display = 'none';
        };

        const renderDigiLockerStep = () => {
          const container = document.getElementById('digilockerStepContainer');
          const step = dlStep;
          let html = '';

          if (step === 'consent') {
            html = `
              <div class="digilocker-step">
                <div class="gov-badge"><span class="gov-badge-text">GOVERNMENT OF INDIA</span></div>
                <div class="digilocker-icon-circle"><span class="digi-emoji">🔐</span></div>
                <div class="digilocker-step-title">DigiLocker</div>
                <div class="digilocker-step-sub">Digital Document Wallet</div>
                <div class="digilocker-divider"></div>
                <div class="digilocker-permissions">
                  <div class="digilocker-permission-title">Requesting access to:</div>
                  <div class="digilocker-permission-item">
                    <span class="digilocker-permission-check">✅</span>
                    <span class="digilocker-permission-text">Verify your identity</span>
                  </div>
                  <div class="digilocker-permission-item">
                    <span class="digilocker-permission-check">✅</span>
                    <span class="digilocker-permission-text">Fetch Aadhaar details (Name, DOB, Address)</span>
                  </div>
                  <div class="digilocker-permission-item">
                    <span class="digilocker-permission-check">✅</span>
                    <span class="digilocker-permission-text">Retrieve registered mobile number</span>
                  </div>
                </div>
                <div class="digilocker-note">Your data will only be used for this verification and will not be stored without your consent.</div>
                <div class="digilocker-btn-group">
                  <button class="digilocker-btn-primary" onclick="window.dlProceedToAadhaar()">Allow & Continue →</button>
                  <button class="digilocker-btn-cancel" onclick="closeDigiLocker()">Cancel</button>
                </div>
              </div>
            `;
          } else if (step === 'aadhaar') {
            html = `
              <div class="digilocker-step">
                <div class="gov-badge"><span class="gov-badge-text">GOVERNMENT OF INDIA</span></div>
                <div class="digilocker-icon-circle"><span class="digi-emoji">🆔</span></div>
                <div class="digilocker-step-title">Verify with Aadhaar</div>
                <div class="digilocker-step-sub">Enter your 12-digit Aadhaar number</div>
                <div class="digilocker-divider"></div>
                <div class="digilocker-aadhaar-box">
                  <span class="digi-icon">🆔</span>
                  <input class="digilocker-aadhaar-input" id="dlAadhaarInput" placeholder="XXXX XXXX XXXX" type="tel" maxlength="12" value="${dlAadhaar}" />
                </div>
                <div class="digilocker-aadhaar-hint">Demo: Try 123412341234, 567856785678, or any 12-digit number</div>
                <div class="digilocker-btn-group" style="margin-top:16px">
                  <button class="digilocker-btn-primary" id="dlVerifyBtn" onclick="window.dlStartVerification()">Verify with DigiLocker →</button>
                  <button class="digilocker-back-btn" onclick="window.dlGoBack()">← Back</button>
                </div>
              </div>
            `;
          } else if (step === 'verifying') {
            html = `
              <div class="digilocker-step">
                <div class="gov-badge"><span class="gov-badge-text">GOVERNMENT OF INDIA</span></div>
                <div class="digilocker-loading"><span class="digilocker-loading-emoji">🔐</span></div>
                <div class="digilocker-verifying-title">Verifying with DigiLocker...</div>
                <div class="digilocker-verifying-sub">Fetching your Aadhaar details</div>
                <div class="digilocker-verifying-steps">
                  <div class="digilocker-verifying-step">
                    <span class="digilocker-verifying-step-icon">⟳</span>
                    <span class="digilocker-verifying-step-text">Connecting to DigiLocker</span>
                  </div>
                  <div class="digilocker-verifying-step">
                    <span class="digilocker-verifying-step-icon">⟳</span>
                    <span class="digilocker-verifying-step-text">Authenticating Aadhaar</span>
                  </div>
                  <div class="digilocker-verifying-step">
                    <span class="digilocker-verifying-step-icon">⟳</span>
                    <span class="digilocker-verifying-step-text">Fetching documents</span>
                  </div>
                </div>
                <div class="digilocker-spinner"></div>
              </div>
            `;
          } else if (step === 'verified') {
            const d = dlData || { name: 'Verified User', dob: '01/01/1995', gender: 'Male', address: 'DigiLocker Verified Address, India', phone: '9876543210' };
            const last4 = dlAadhaar.slice(-4);
            html = `
              <div class="digilocker-step">
                <div class="gov-badge"><span class="gov-badge-text">GOVERNMENT OF INDIA</span></div>
                <div class="digilocker-success"><span class="digilocker-success-emoji">✅</span></div>
                <div class="digilocker-verified-title">Verified Successfully!</div>
                <div class="digilocker-verified-sub">Aadhaar details fetched from DigiLocker</div>
                <div class="digilocker-divider"></div>
                <div class="digilocker-data-rows">
                  <div class="digilocker-data-row">
                    <span class="digilocker-data-label">Name</span>
                    <span class="digilocker-data-value">${d.name}</span>
                  </div>
                  <div class="digilocker-data-row">
                    <span class="digilocker-data-label">DOB</span>
                    <span class="digilocker-data-value">${d.dob}</span>
                  </div>
                  <div class="digilocker-data-row">
                    <span class="digilocker-data-label">Gender</span>
                    <span class="digilocker-data-value">${d.gender}</span>
                  </div>
                  <div class="digilocker-data-row">
                    <span class="digilocker-data-label">Address</span>
                    <span class="digilocker-data-value">${d.address}</span>
                  </div>
                  <div class="digilocker-data-row">
                    <span class="digilocker-data-label">Phone</span>
                    <span class="digilocker-data-value">${d.phone}</span>
                  </div>
                </div>
                <span class="digilocker-success-note">✓ DigiLocker Verified | Aadhaar XXXXXXXX${last4}</span>
              </div>
            `;
          }

          container.innerHTML = html;

          // Attach event listener + auto-focus for Aadhaar input
          if (step === 'aadhaar') {
            const inp = document.getElementById('dlAadhaarInput');
            if (inp) {
              // Remove old listener (by replacing element) and add new one
              const handler = (e) => {
                const filtered = e.target.value.replace(/[^0-9]/g, '').slice(0, 12);
                e.target.value = filtered;
                dlAadhaar = filtered;
              };
              inp.addEventListener('input', handler);
              setTimeout(() => inp.focus(), 100);
            }
          }
        };

        window.dlProceedToAadhaar = () => {
          dlStep = 'aadhaar';
          renderDigiLockerStep();
        };

        window.dlGoBack = () => {
          dlStep = 'consent';
          renderDigiLockerStep();
        };

        window.dlStartVerification = () => {
          const aadhaar = document.getElementById('dlAadhaarInput')?.value || dlAadhaar;
          if (aadhaar.length !== 12) {
            showAlert('Error', 'Enter a valid 12-digit Aadhaar number');
            return;
          }
          dlAadhaar = aadhaar;
          dlStep = 'verifying';
          renderDigiLockerStep();

          // Simulate API call
          setTimeout(() => {
            dlData = DL_MOCK_AADHAAR[dlAadhaar] || { name: 'Verified User', dob: '01/01/1995', gender: 'Male', address: 'DigiLocker Verified Address, India', phone: '9876543210' };
            dlStep = 'verified';
            renderDigiLockerStep();

            // Auto-close after success
            setTimeout(() => {
              closeDigiLocker();
              // Auto-fill form
              document.getElementById('custName').value = dlData.name;
              document.getElementById('custPhone').value = dlData.phone;
              document.getElementById('custDigiBadge').style.display = 'flex';
              showAlert('DigiLocker Verified', `Aadhaar verified for ${dlData.name}! Details have been auto-filled.`);
            }, 1500);
          }, 2500);
        };

        window.sendCustOtp = () => {
          const name = document.getElementById('custName').value.trim();
          const email = document.getElementById('custEmail').value.trim();
          const phone = document.getElementById('custPhone').value.trim();
          const location = document.getElementById('custLocation').value.trim();
          const pincode = document.getElementById('custPincode').value.trim();
          if (!name) { showAlert('Error', 'Enter your name!'); return; }
          if (!email) { showAlert('Error', 'Enter your email!'); return; }
          if (phone.length !== 10) { showAlert('Error', 'Enter valid 10 digit number!'); return; }
          if (!location) { showAlert('Error', 'Enter your location!'); return; }
          if (!/^\d{6}$/.test(pincode)) { showAlert('Error', 'Enter a valid 6-digit pincode!'); return; }
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
          const pincode = document.getElementById('custPincode').value.trim();
          if (otp !== '123456') { showAlert('Error', 'Invalid OTP'); return; }
          Store.clear();
          Store.set('custName', name);
          Store.set('custEmail', email);
          Store.set('custPhone', phone);
          Store.set('custLocation', location);
          Store.set('custPincode', pincode);
          Store.set('digilockerVerified', dlData ? 'true' : 'false');
          // Save push token placeholder
          Store.set('pushToken', 'web-user-' + Date.now());
          // Save to Firebase
          firebase.database().ref('users/' + phone).update({
            name, phone, location, pincode,
            pushToken: Store.get('pushToken'),
            digilockerVerified: dlData ? true : false,
          });
          Router.navigate('home');
        };
        return () => {
          delete window.sendCustOtp;
          delete window.verifyCustOtp;
          delete window.openDigiLocker;
          delete window.closeDigiLocker;
          delete window.dlProceedToAadhaar;
          delete window.dlGoBack;
          delete window.dlStartVerification;
        };
      }
    };
  }
});
