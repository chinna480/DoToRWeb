// Payment Screen
const PAYMENT_METHODS = [
  { id: 'upi', name: 'UPI', icon: '📱', desc: 'Google Pay, PhonePe, Paytm', color: '#8B5CF6' },
  { id: 'card', name: 'Credit / Debit Card', icon: '💳', desc: 'Visa, Mastercard, RuPay', color: '#3B82F6' },
  { id: 'wallet', name: 'DoToR Wallet', icon: '💰', desc: 'Pay using wallet balance', color: '#FF6B00' },
  { id: 'cod', name: 'Cash on Delivery', icon: '💵', desc: 'Pay when service is done', color: '#2e7d32' },
];

Router.register('payment', {
  render() {
    const methodsHtml = PAYMENT_METHODS.map((m, i) => `
      <div class="payment-method" data-method="${m.id}" onclick="window.selectPayment('${m.id}')">
        <div class="payment-method-icon-box" style="background:${m.color}20">
          <span class="payment-method-icon">${m.icon}</span>
        </div>
        <div class="payment-method-info">
          <div class="payment-method-name">${m.name}</div>
          <div class="payment-method-desc">${m.desc}</div>
        </div>
        <div class="payment-radio" id="radio_${m.id}"><div class="payment-radio-dot" style="display:none"></div></div>
      </div>
    `).join('');

    return {
      html: `
        <div class="screen">
          <div class="header header-dark">
            <button class="header-back" onclick="Router.navigate('home')">←</button>
            <span class="header-title">💳 Payment</span>
            <div style="width:40px"></div>
          </div>
          <div class="payment-amount-card glass-strong">
            <div class="payment-amount-label">💰 Total Amount</div>
            <div class="payment-amount-value">₹299</div>
            <div class="payment-amount-sub">Repair service charge (inclusive of all taxes)</div>
          </div>
          <div class="section-title">💳 Select Payment Method</div>
          <div class="payment-methods glass">${methodsHtml}</div>
          <button class="btn btn-primary btn-block" id="proceedBtn" style="margin:15px;width:calc(100% - 30px)" onclick="window.proceedPayment()" disabled>Proceed to Pay →</button>
          <div class="payment-security glass" style="padding:12px 18px;margin:15px;border-radius:var(--radius-sm);display:flex;align-items:center;gap:8px;justify-content:center">
            <span style="font-size:16px">🔒</span>
            <span class="payment-security-text">Your payment info is secure. We never store card details.</span>
          </div>
        </div>
      `,
      init() {
        let selectedMethod = null;

        window.selectPayment = (id) => {
          selectedMethod = id;
          document.querySelectorAll('.payment-radio').forEach(r => r.classList.remove('active'));
          document.querySelectorAll('.payment-radio-dot').forEach(d => d.style.display = 'none');
          document.getElementById('radio_' + id).classList.add('active');
          document.getElementById('radio_' + id).querySelector('.payment-radio-dot').style.display = 'block';
          document.getElementById('proceedBtn').disabled = false;
          document.getElementById('proceedBtn').textContent = id === 'cod' ? 'Confirm Cash on Delivery →' : 'Pay ₹299 →';
        };

        window.proceedPayment = () => {
          if (!selectedMethod) { showAlert('Select Method', 'Please select a payment method'); return; }

          if (selectedMethod === 'cod') {
            showAlert('✅ Cash on Delivery', 'Pay ₹299 at your doorstep.', [{ text: 'OK', onPress: () => Router.navigate('home') }]);
            return;
          }

          if (selectedMethod === 'upi') {
            // Show UPI screen
            const app = document.getElementById('app');
            app.innerHTML = `
              <div class="screen">
                <div class="header header-dark">
                  <button class="header-back" onclick="Router.navigate('payment')">←</button>
                  <span class="header-title">📱 UPI Payment</span>
                  <div style="width:40px"></div>
                </div>
                <div class="payment-amount-card glass-strong">
                  <div class="payment-amount-label">💰 Amount to Pay</div>
                  <div class="payment-amount-value">₹299</div>
                </div>
                <div class="upi-card glass">
                  <div class="upi-label">Scan or enter UPI ID</div>
                  <div class="upi-input-row">
                    <input class="upi-input" id="upiId" value="dotor@upi" />
                    <button class="btn btn-sm btn-outline" onclick="window.copyUPI()">📋</button>
                  </div>
                  <button class="btn btn-primary btn-block" onclick="window.payWithUPI()">Pay ₹299 via UPI →</button>
                  <div class="upi-note">Supported apps: Google Pay, PhonePe, Paytm, BHIM</div>
                </div>
              </div>
            `;
            window.copyUPI = () => showAlert('📱 UPI ID', 'Pay to this UPI ID:\n\ndotor@upi');
            window.payWithUPI = () => {
              const upiLink = 'upi://pay?pa=dotor@upi&pn=DoToR&am=299&cu=INR&tn=Repair Payment';
              window.open(upiLink, '_blank');
              showAlert('Open UPI App', 'Please open Google Pay / PhonePe to complete payment.', [{ text: 'OK', onPress: () => Router.navigate('home') }]);
            };
            return;
          }

          if (selectedMethod === 'card') {
            const app = document.getElementById('app');
            app.innerHTML = `
              <div class="screen">
                <div class="header header-dark">
                  <button class="header-back" onclick="Router.navigate('payment')">←</button>
                  <span class="header-title">💳 Card Payment</span>
                  <div style="width:40px"></div>
                </div>
                <div class="payment-amount-card glass-strong">
                  <div class="payment-amount-label">💰 Amount to Pay</div>
                  <div class="payment-amount-value">₹299</div>
                </div>
                <div class="card-form glass">
                  <label class="card-form-label">Card Number</label>
                  <input class="card-form-input" placeholder="1234 5678 9012 3456" maxlength="19" />
                  <div class="card-form-row">
                    <div><label class="card-form-label">Expiry</label><input class="card-form-input" placeholder="MM/YY" maxlength="5" /></div>
                    <div><label class="card-form-label">CVV</label><input class="card-form-input" placeholder="123" type="password" maxlength="4" /></div>
                  </div>
                  <label class="card-form-label">Cardholder Name</label>
                  <input class="card-form-input" placeholder="John Doe" />
                  <button class="btn btn-primary btn-block" style="margin-top:15px" onclick="window.payCard()">Pay ₹299 →</button>
                  <div class="card-secure-note">🔒 Secured with 256-bit encryption</div>
                </div>
              </div>
            `;
            window.payCard = () => {
              showAlert('✅ Payment Successful!', 'Your payment of ₹299 has been processed.', [{ text: 'OK', onPress: () => Router.navigate('home') }]);
            };
            return;
          }

          if (selectedMethod === 'wallet') {
            showAlert('💰 DoToR Wallet', 'Your wallet balance: ₹0\n\nAdd money to use wallet payments.');
          }
        };

        return () => { delete window.selectPayment; delete window.proceedPayment; };
      }
    };
  }
});
