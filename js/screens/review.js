// Review Screen - Rate the service - Bento Glass
Router.register('review', {
  render() {
    return {
      html: `
        <div class="screen">
          <div class="review-header">
            <div class="review-title">⭐ Rate Your Experience</div>
            <div class="review-sub">How was your repair service?</div>
          </div>
          <div class="scroll-content">
            <div class="glass" style="margin-top:15px;padding:18px">
              <div class="card-title">Tap to rate</div>
              <div class="review-stars" id="starContainer">
                ${[1,2,3,4,5].map(s => `<button class="review-star" data-star="${s}" onclick="window.setRating(${s})">★</button>`).join('')}
              </div>
              <div class="review-rating-label" id="ratingLabel">No rating yet</div>
            </div>
            <div class="glass" style="margin-top:12px;padding:18px">
              <div class="card-title">✍️ Write a comment (optional)</div>
              <textarea class="form-textarea" id="reviewComment" placeholder="Tell us about your experience..."></textarea>
            </div>
            <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="window.submitReview()">⭐ Submit Review →</button>
          </div>
        </div>
      `,
      init() {
        let rating = 0;
        const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent! ✨'];

        window.setRating = (r) => {
          rating = r;
          document.querySelectorAll('.review-star').forEach(s => {
            s.classList.toggle('active', parseInt(s.dataset.star) <= r);
          });
          document.getElementById('ratingLabel').textContent = labels[r];
        };

        window.submitReview = async () => {
          if (rating === 0) { showAlert('Please select a rating!'); return; }
          const comment = document.getElementById('reviewComment').value.trim();
          const name = Store.get('custName', 'Customer');
          try {
            await firebase.database().ref('reviews/' + Date.now()).update({
              customerName: name,
              rating,
              comment,
              time: new Date().toLocaleTimeString(),
            });
          } catch (e) {}
          // Show thank you
          const app = document.getElementById('app');
          app.innerHTML = `
            <div class="screen thank-you">
              <div class="thank-icon">🎉</div>
              <div class="thank-title">Thank You!</div>
              <div class="thank-sub">Your review helps us improve ✨</div>
              <button class="btn btn-primary btn-block" style="margin-top:30px" onclick="Router.navigate('home')">🏠 Back to Home</button>
            </div>
          `;
        };

        return () => { delete window.setRating; delete window.submitReview; };
      }
    };
  }
});
