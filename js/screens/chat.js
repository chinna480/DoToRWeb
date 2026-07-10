// Chat Screen - Real-time messaging with Bento Glass styling
Router.register('chat', {
  render(params) {
    const orderId = params.orderId || Store.get('lastOrderId', 'current');
    return {
      html: `
        <div class="screen chat-container">
          <!-- Glass Chat Header -->
          <div class="chat-header">
            <button class="chat-back" onclick="window.chatBack()">←</button>
            <div class="chat-header-center">
              <div class="chat-avatar-sm glass-strong"><span class="chat-avatar-text">🔧</span></div>
              <div>
                <div class="chat-header-name">DoToR Support</div>
                <div class="chat-header-status">🟢 Online</div>
              </div>
            </div>
            <button class="header-icon-btn" onclick="Router.navigate('tracking')" aria-label="Track">📍</button>
          </div>
          <div class="chat-messages" id="chatMessages">
            <div class="chat-loading">
              <div style="font-size:40px;margin-bottom:12px">💬</div>
              <div>Loading messages...</div>
            </div>
          </div>
          <!-- Glass Input Bar -->
          <div class="chat-input-bar glass-strong">
            <div class="chat-input-row">
              <textarea class="chat-input" id="chatInput" placeholder="Type a message... 📝" rows="1" maxlength="500"></textarea>
              <button class="chat-send-btn" id="chatSendBtn" onclick="window.sendChatMsg()" disabled>➤</button>
            </div>
          </div>
        </div>
      `,
      init(params2) {
        const p = params2 || params;
        const customerName = p.customerName || Store.get('custName', 'Customer');
        const orderId = p.orderId || Store.get('lastOrderId', 'current');
        const myName = Store.get('custName', 'Customer');
        const role = 'cust'; // Customer-only chat

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
                <div class="chat-empty-sub">Send a message to start chatting! 🚀</div>
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
              html += `<div class="chat-date-badge"><span class="chat-date-text glass">${dateLabel}</span></div>`;
              lastDate = dateLabel;
            }
            const isMine = m.senderRole === role;
            html += `
              <div class="chat-bubble ${isMine ? 'chat-bubble-my' : 'chat-bubble-other'}">
                ${!isMine ? `<div class="chat-sender-name">🔧 ${m.senderName}</div>` : ''}
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
              lastSender: 'cust',
              lastTime: Date.now(),
              customerName: customerName,
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
          Router.navigate('tracking');
        };

        return () => {
          msgsRef.off('value', onMsgs);
          delete window.sendChatMsg;
          delete window.chatBack;
        };
      }
    };
  }
});
