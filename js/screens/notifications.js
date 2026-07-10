// Notifications Screen - Bento Glass
Router.register('notifications', {
  render() {
    return {
      html: `
        <div class="screen">
          <div class="header header-dark">
            <span class="header-title" style="flex:1;text-align:center">🔔 Notifications</span>
            <div style="width:40px"></div>
          </div>
          <div class="scroll-content">
            <div class="glass" style="margin-top:60px;padding:30px 20px;text-align:center">
              <div style="font-size:50px;margin-bottom:15px">🔔</div>
              <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px">No Notifications Yet</div>
              <div style="font-size:13px;color:var(--text-secondary);line-height:22px;font-weight:600">
                You'll see order updates,<br>promotions, and other alerts here. ✨
              </div>
            </div>
          </div>
        </div>
      `,
      init() {
        return () => {};
      }
    };
  }
});
