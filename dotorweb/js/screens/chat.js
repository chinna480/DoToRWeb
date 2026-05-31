// Chat Screen - Real-time messaging
Router.register('chat', {
  render(params) {
    const role = params.role || 'cust';
    const otherName = role === 'cust' ? (params.techName || 'Technician') : (params.customerName || 'Customer');
    const orderId = params.orderId || Store.get('lastOrderId', 'current');
    return {
      html: `
        <div class="screen chat-container">
          <div class="chat-header">
            <button class="chat-back" onclick="window.chatBack()">←</button>
            <div class="chat-header-center">
              <div class="chat-avatar-sm"><span class="chat-avatar-text">${role === 'cust' ? '🔧' : '👤'}</span></div>
              <div>
                <div class="chat-header-name">${otherName}</div>
                <div class="chat-header-status">🟢 Online</div>
              </div>
            </div>
            <div style="width:40px"></div>
          </div>
          <div class="chat-messages" id="chatMessages">
            <div class="chat-loading">⏳ Loading messages...</div>
          </div>
          <div class="chat-input-bar">
            <div class="chat-input-row">
              <textarea class="chat-input" id="chatInput" placeholder="Type a message..." rows="1" maxlength="500"></textarea>
              <button class="chat-send-btn" id="chatSendBtn" onclick="window.sendChatMsg()">➤</button>
            </div>
          </div>
        </div>
      `,
      init(params2) {
        const p = params2 || params;
        const role = p.role || 'cust';
        const orderId = p.orderId || Store.get('lastOrderId', 'current');
        const myName = Store.get(role + 'Name', role === 'cust' ? 'Customer' : 'Technician');

        // Listen for order updates to dynamically show the correct tech name
        let orderListenerRef = null;
        if (role === 'cust' && orderId) {
          const orderRef = firebase.database().ref('orders/' + orderId);
          const onOrderUpdate = (snap) => {
            if (snap.exists()) {
              const order = snap.val();
              if (order.techName) {
                const headerNameEl = document.querySelector('.chat-header-name');
                if (headerNameEl) headerNameEl.textContent = order.techName;
              }
            }
          };
          orderRef.on('value', onOrderUpdate);
          orderListenerRef = { ref: orderRef, handler: onOrderUpdate };
        }

        // Listen for messages
        const msgsRef = firebase.database().ref('chats/' + orderId + '/messages');
        const onMsgs = (snap) => {
          const container = document.getElementById('chatMessages');
          if (!container) return;
          if (!snap.exists()) {
            container.innerHTML = `
              <div class="chat-empty">
                <div class="chat-empty-icon">💬</div>
                <div class="chat-empty-text">No messages yet</div>
                <div class="chat-empty-sub">Send a message to start chatting!</div>
              </div>
            `;
            return;
          }
          const msgs = [];
          snap.forEach(child => msgs.push({ id: child.key, ...child.val() }));
          let html = '';
          let lastDate = '';
          msgs.forEach(m => {
            const dateLabel = formatDate(m.timestamp);
            if (dateLabel !== lastDate) {
              html += `<div class="chat-date-badge"><span class="chat-date-text">${dateLabel}</span></div>`;
              lastDate = dateLabel;
            }
            const isMine = m.senderRole === role;
            html += `
              <div class="chat-bubble ${isMine ? 'chat-bubble-my' : 'chat-bubble-other'}">
                ${!isMine ? `<div class="chat-sender-name">${m.senderName}</div>` : ''}
                <div class="chat-text ${isMine ? 'chat-text-my' : ''}">${m.text}</div>
                <div class="chat-time ${isMine ? 'chat-time-my' : ''}">${formatTime(m.timestamp)}${isMine ? (m.read ? ' ✓✓' : ' ✓') : ''}</div>
              </div>
            `;
          });
          container.innerHTML = html;
          container.scrollTop = container.scrollHeight;
        };
        msgsRef.on('value', onMsgs);

        window.sendChatMsg = () => {
          const input = document.getElementById('chatInput');
          const text = input.value.trim();
          if (!text) return;
          const metaRef = firebase.database().ref('chats/' + orderId + '/metadata');
          firebase.database().ref('chats/' + orderId + '/messages').push({
            text,
            senderRole: role,
            senderName: myName,
            timestamp: Date.now(),
            read: false,
          }).then(() => {
            metaRef.set({
              lastMessage: text,
              lastSender: role,
              lastTime: Date.now(),
              customerName: p.customerName || '',
              techName: p.techName || '',
            });
          }).catch(() => showAlert('Error', 'Failed to send message'));
          input.value = '';
          input.style.height = 'auto';
          document.getElementById('chatSendBtn').disabled = true;
        };

        // Auto-resize textarea
        document.getElementById('chatInput')?.addEventListener('input', function() {
          this.style.height = 'auto';
          this.style.height = Math.min(this.scrollHeight, 100) + 'px';
          document.getElementById('chatSendBtn').disabled = !this.value.trim();
        });

        window.chatBack = () => {
          if (role === 'cust') Router.navigate('tracking');
          else Router.navigate('tech-home');
        };

        return () => {
          msgsRef.off('value', onMsgs);
          if (orderListenerRef) {
            orderListenerRef.ref.off('value', orderListenerRef.handler);
          }
          delete window.sendChatMsg;
          delete window.chatBack;
        };
      }
    };
  }
});
