// Technician Login Screen
const TECH_SKILLS = ['📱 Phone Repair', '💻 Laptop Repair', '🍎 iPhone Repair', '🖥️ Screen Replacement', '🔋 Battery Replacement', '💾 Software Issues'];
const TECH_EXP = ['0 - 1 Year', '1 - 2 Years', '2 - 5 Years', '5+ Years'];

// Simulated Aadhaar data for DigiLocker demo
const DL_MOCK_AADHAAR = {
  '123412341234': { name: 'Rahul Sharma', dob: '15/08/1995', gender: 'Male', address: '42, MG Road, Indiranagar, Bangalore - 560038', phone: '9876543210' },
  '567856785678': { name: 'Priya Patel', dob: '22/03/1998', gender: 'Female', address: '7, Lake View Apartments, Koramangala, Bangalore - 560034', phone: '8765432109' },
  '901290129012': { name: 'Amit Kumar', dob: '10/11/1992', gender: 'Male', address: '15, Gandhi Nagar, Hyderabad - 500080', phone: '9988776655' },
};

Router.register('tech-login', {
  render() {
    const skillsHtml = TECH_SKILLS.map(s => `
      <div class="skill-row" data-skill="${s}">
        <div class="checkbox"><span class="checkmark" style="display:none">✓</span></div>
        <span class="skill-text">${s}</span>
      </div>
    `).join('');
    const expHtml = TECH_EXP.map(e => `<div class="dropdown-item" data-exp="${e}">${e}</div>`).join('');
    return {
      html: `
        <div class="screen">
          <div class="header header-dark">
            <button class="header-back" onclick="Router.navigate('role')">←</button>
            <div class="header-center">
              <div style="font-size:45px;margin-bottom:4px">🔧</div>
              <div class="header-title">Technician Login</div>
              <div class="header-sub">Join DoToR and start earning!</div>
            </div>
            <div style="width:40px"></div>
          </div>
          <div class="scroll-content">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <div class="form-field">
                <span class="form-icon">👤</span>
                <input class="form-input" id="techName" placeholder="Enter your full name" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <div class="form-field">
                <span class="form-icon">🇮🇳 +91</span>
                <input class="form-input" id="techPhone" placeholder="Enter 10 digit number" type="tel" maxlength="10" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Location</label>
              <div class="form-field" style="position:relative">
                <span class="form-icon">📍</span>
                <input class="form-input" id="techLocation" placeholder="Search your area..." type="text" autocomplete="off" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Pincode</label>
              <div class="form-field">
                <span class="form-icon">📮</span>
                <input class="form-input" id="techPincode" placeholder="Enter 6-digit pincode" type="tel" maxlength="6" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Experience</label>
              <div class="form-field" id="expField" style="cursor:pointer">
                <span class="form-icon">⭐</span>
                <span class="form-input" id="expDisplay" style="color:#aaa">Select Experience</span>
                <span style="color:var(--gray)" id="expArrow">▼</span>
              </div>
              <div class="dropdown" id="expDropdown" style="display:none">${expHtml}</div>
            </div>
            <div class="form-group">
              <label class="form-label">Skills</label>
              <div class="skills-box" id="skillsBox">${skillsHtml}</div>
            </div>

            <!-- 🔐 DIGILOCKER AADHAAR VERIFICATION -->
            <div class="form-group">
              <label class="form-label">Aadhaar Verification</label>
              <div class="security-box">
                <button class="digilocker-btn" onclick="window.openDigiLocker('tech')">
                  <span class="digilocker-btn-icon">🔐</span>
                  <span>Verify via DigiLocker</span>
                </button>
                <div id="techDigiBadge" style="display:none" class="digilocker-verified-badge">
                  <span class="digilocker-verified-badge-icon">✅</span>
                  <span class="digilocker-verified-badge-text">Aadhaar Verified via DigiLocker</span>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Upload Certificate</label>
              <div class="upload-box" id="certUpload">
                <div class="upload-icon">📄</div>
                <div class="upload-text">Tap to upload Certificate</div>
                <div class="upload-sub">JPG, PNG accepted</div>
              </div>
              <input type="file" id="certInput" accept="image/*" class="hidden-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Upload Aadhar Card (Manual)</label>
              <div class="upload-box" id="aadharUpload">
                <div class="upload-icon">🪪</div>
                <div class="upload-text">Tap to upload Aadhar Card</div>
                <div class="upload-sub">JPG, PNG accepted</div>
              </div>
              <input type="file" id="aadharInput" accept="image/*" class="hidden-input" />
            </div>
            <button class="btn btn-dark btn-block" onclick="window.registerTech()">Register & Continue →</button>
            <div class="login-switch">
              Need Repair? <span class="login-link" onclick="Router.navigate('customer-login')">Customer Login</span>
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
        let selectedExp = '';
        let selectedSkills = new Set();
        let certFile = null;
        let aadharFile = null;
        let dlStep = 'consent';
        let dlAadhaar = '';
        let dlData = null;

        // Experience dropdown
        document.getElementById('expField').addEventListener('click', () => {
          const dd = document.getElementById('expDropdown');
          dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
          document.getElementById('expArrow').textContent = dd.style.display === 'none' ? '▼' : '▲';
        });
        document.querySelectorAll('#expDropdown .dropdown-item').forEach(el => {
          el.addEventListener('click', () => {
            selectedExp = el.dataset.exp;
            document.getElementById('expDisplay').textContent = selectedExp;
            document.getElementById('expDisplay').style.color = '#1A3A6B';
            document.getElementById('expDropdown').style.display = 'none';
            document.getElementById('expArrow').textContent = '▼';
            document.querySelectorAll('#expDropdown .dropdown-item').forEach(e => e.classList.remove('active'));
            el.classList.add('active');
          });
        });

        // Skills
        document.querySelectorAll('#skillsBox .skill-row').forEach(el => {
          el.addEventListener('click', () => {
            const skill = el.dataset.skill;
            const cb = el.querySelector('.checkbox');
            const cm = el.querySelector('.checkmark');
            if (selectedSkills.has(skill)) {
              selectedSkills.delete(skill);
              cb.classList.remove('active');
              cm.style.display = 'none';
            } else {
              selectedSkills.add(skill);
              cb.classList.add('active');
              cm.style.display = 'block';
            }
          });
        });

        // Certificate upload
        document.getElementById('certUpload').addEventListener('click', () => document.getElementById('certInput').click());
        document.getElementById('certInput').addEventListener('change', (e) => {
          if (e.target.files.length) {
            certFile = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
              document.getElementById('certUpload').innerHTML = `
                <img src="${ev.target.result}" class="upload-preview" />
                <div class="upload-done-text">✅ Certificate Uploaded</div>
                <div class="upload-change-text">Tap to change</div>
              `;
              document.getElementById('certUpload').classList.add('done');
            };
            reader.readAsDataURL(certFile);
          }
        });

        // Aadhar upload
        document.getElementById('aadharUpload').addEventListener('click', () => document.getElementById('aadharInput').click());
        document.getElementById('aadharInput').addEventListener('change', (e) => {
          if (e.target.files.length) {
            aadharFile = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
              document.getElementById('aadharUpload').innerHTML = `
                <img src="${ev.target.result}" class="upload-preview" />
                <div class="upload-done-text">✅ Aadhar Card Uploaded</div>
                <div class="upload-change-text">Tap to change</div>
              `;
              document.getElementById('aadharUpload').classList.add('done');
            };
            reader.readAsDataURL(aadharFile);
          }
        });

        // Initialize Google Places Autocomplete for location
        window.GOOGLE_MAPS_LOADED.then(() => {
          const input = document.getElementById('techLocation');
          if (input && typeof google !== 'undefined' && google.maps?.places) {
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
          }
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

          if (step === 'aadhaar') {
            const inp = document.getElementById('dlAadhaarInput');
            if (inp) {
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
              // Auto-fill name
              document.getElementById('techName').value = dlData.name;
              document.getElementById('techDigiBadge').style.display = 'flex';
              aadharFile = 'digilocker_verified';
              showAlert('DigiLocker Verified', `Aadhaar verified for ${dlData.name}! Name auto-filled.`);
            }, 1500);
          }, 2500);
        };

        // ─── Register ───
        window.registerTech = () => {
          const name = document.getElementById('techName').value.trim();
          const phone = document.getElementById('techPhone').value.trim();
          const location = document.getElementById('techLocation').value.trim();
          const pincode = document.getElementById('techPincode').value.trim();

          if (!name) { showAlert('Error', 'Enter your name!'); return; }
          if (phone.length !== 10) { showAlert('Error', 'Enter valid 10 digit number!'); return; }
          if (!location) { showAlert('Error', 'Enter your location!'); return; }
          if (!/^\d{6}$/.test(pincode)) { showAlert('Error', 'Enter a valid 6-digit pincode!'); return; }
          if (!selectedExp) { showAlert('Error', 'Select your experience!'); return; }
          if (selectedSkills.size === 0) { showAlert('Error', 'Select at least one skill!'); return; }
          if (!certFile) { showAlert('Error', 'Upload your Certificate!'); return; }
          if (!aadharFile) { showAlert('Error', 'Verify your Aadhaar via DigiLocker or upload manually!'); return; }

          Store.clear();
          Store.set('techName', name);
          Store.set('techPhone', phone);
          Store.set('techLocation', location);
          Store.set('techPincode', pincode);
          Store.set('techExp', selectedExp);
          Store.set('techSkills', Array.from(selectedSkills));
          Store.set('digilockerVerified', dlData ? 'true' : 'false');

          firebase.database().ref('techs/' + phone).update({
            name, phone, location, pincode,
            digilockerVerified: dlData ? true : false,
          }).catch(() => {});
          Router.navigate('tech-home');
        };

        return () => {
          delete window.registerTech;
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
