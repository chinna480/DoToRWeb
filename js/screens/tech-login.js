// Technician Login Screen
const TECH_SKILLS = ['📱 Phone Repair', '💻 Laptop Repair', '🍎 iPhone Repair', '🖥️ Screen Replacement', '🔋 Battery Replacement', '💾 Software Issues'];
const TECH_EXP = ['0 - 1 Year', '1 - 2 Years', '2 - 5 Years', '5+ Years'];

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
              <div class="form-field">
                <span class="form-icon">📍</span>
                <input class="form-input" id="techLocation" placeholder="Enter your area" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Pincode</label>
              <div class="form-field">
                <span class="form-icon">📮</span>
                <input class="form-input" id="techPincode" placeholder="Enter 6 digit pincode" type="tel" maxlength="6" />
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
              <label class="form-label">Upload Aadhar Card</label>
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
      `,
      init() {
        let selectedExp = '';
        let selectedSkills = new Set();
        let certFile = null;
        let aadharFile = null;

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

        window.registerTech = () => {
          const name = document.getElementById('techName').value.trim();
          const phone = document.getElementById('techPhone').value.trim();
          const location = document.getElementById('techLocation').value.trim();
          const pincode = document.getElementById('techPincode').value.trim();

          if (!name) { showAlert('Error', 'Enter your name!'); return; }
          if (phone.length !== 10) { showAlert('Error', 'Enter valid 10 digit number!'); return; }
          if (!location) { showAlert('Error', 'Enter your location!'); return; }
          if (!pincode || pincode.length !== 6) { showAlert('Error', 'Enter valid 6 digit pincode!'); return; }
          if (!selectedExp) { showAlert('Error', 'Select your experience!'); return; }
          if (selectedSkills.size === 0) { showAlert('Error', 'Select at least one skill!'); return; }
          if (!certFile) { showAlert('Error', 'Upload your Certificate!'); return; }
          if (!aadharFile) { showAlert('Error', 'Upload your Aadhar Card!'); return; }

          Store.clear();
          Store.set('userRole', 'tech');
          Store.set('techName', name);
          Store.set('techPhone', phone);
          Store.set('techLocation', location);
          Store.set('techPincode', pincode);
          Store.set('techExp', selectedExp);
          Store.set('techSkills', Array.from(selectedSkills));

          firebase.database().ref('techs/' + phone).update({ name, phone, location, pincode }).catch(() => {});
          Router.navigate('tech-home');
        };

        return () => { delete window.registerTech; };
      }
    };
  }
});
