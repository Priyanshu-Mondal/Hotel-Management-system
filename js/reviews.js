// reviews.js - Customer reviews & ratings
const Reviews = (() => {
    let reviewsList = [];
    let selectedRating = 0;

    function renderStars(rating) {
        let html = '<span class="stars-display">';
        for (let i = 1; i <= 5; i++) {
            html += `<span class="star ${i <= rating ? 'filled' : ''}">★</span>`;
        }
        html += '</span>';
        return html;
    }

    async function loadReviews() {
        reviewsList = await API.getReviews();
    }

    function renderSummary() {
        const el = document.getElementById('reviews-summary');
        if (!el) return;
        if (reviewsList.length === 0) {
            el.innerHTML = `<div class="empty-state-card"><span class="empty-state-icon">⭐</span><h3>No reviews yet</h3><p class="text-muted">Be the first to share your experience!</p></div>`;
            return;
        }
        const avg = reviewsList.reduce((s, r) => s + Number(r.rating || 0), 0) / reviewsList.length;
        const dist = [5, 4, 3, 2, 1].map(star => {
            const count = reviewsList.filter(r => Number(r.rating) === star).length;
            const pct = (count / reviewsList.length) * 100;
            return `<div class="rating-bar-row"><span>${star}★</span><div class="rating-bar"><div class="rating-fill" style="width:${pct}%"></div></div><span>${count}</span></div>`;
        }).join('');
        el.innerHTML = `
            <div class="reviews-summary-card">
                <div class="reviews-avg-block">
                    <div class="reviews-avg-big">${avg.toFixed(1)}</div>
                    ${renderStars(Math.round(avg))}
                    <p class="text-muted" style="margin-top: 0.5rem;">Based on ${reviewsList.length} review${reviewsList.length > 1 ? 's' : ''}</p>
                </div>
                <div class="rating-distribution">${dist}</div>
            </div>`;
    }

    async function renderList() {
        const el = document.getElementById('reviews-list');
        if (!el) return;
        if (reviewsList.length === 0) { el.innerHTML = ''; return; }
        el.innerHTML = reviewsList.slice().reverse().map(r => `
            <div class="review-card">
                <div class="review-header">
                    <div class="review-author">
                        <div class="review-avatar">${(r.customerName || 'G')[0].toUpperCase()}</div>
                        <div>
                            <strong>${r.customerName || 'Guest'}</strong>
                            <div class="review-meta">Table #${r.tableNo} • ${r.orderId}</div>
                        </div>
                    </div>
                    ${renderStars(r.rating)}
                </div>
                ${r.comment ? `<p class="review-comment">"${r.comment}"</p>` : ''}
                ${r.itemNames && r.itemNames.length ? `<p class="review-items">Items: ${r.itemNames.join(', ')}</p>` : ''}
                <div class="review-footer text-muted">${new Date(r.createdAt).toLocaleString('en-IN')}</div>
            </div>
        `).join('');
    }

    async function setupForm() {
        const orders = await API.getOrders();
        const reviewed = new Set(reviewsList.map(r => String(r.orderId)));
        const available = orders.filter(o =>
            String(o.status).toLowerCase() === 'delivered' && !reviewed.has(String(o.id))
        );

        const select = document.getElementById('review-order-select');
        if (select) {
            select.innerHTML = available.length === 0
                ? '<option value="">No delivered orders to review</option>'
                : '<option value="">— Select a delivered order —</option>' +
                  available.map(o => `<option value="${o.id}">Order #${o.id} • Table #${o.tableNo} • ₹${o.total}</option>`).join('');
        }

        const starsWrap = document.getElementById('star-input');
        if (starsWrap) {
            starsWrap.innerHTML = [1, 2, 3, 4, 5].map(n => `<button type="button" class="star-btn" data-rating="${n}">★</button>`).join('');
            starsWrap.querySelectorAll('.star-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedRating = Number(btn.dataset.rating);
                    starsWrap.querySelectorAll('.star-btn').forEach((b, i) => {
                        b.classList.toggle('active', i < selectedRating);
                    });
                });
                btn.addEventListener('mouseenter', () => {
                    starsWrap.querySelectorAll('.star-btn').forEach((b, i) => b.classList.toggle('hover', i < Number(btn.dataset.rating)));
                });
                btn.addEventListener('mouseleave', () => {
                    starsWrap.querySelectorAll('.star-btn').forEach(b => b.classList.remove('hover'));
                });
            });
        }
    }

    async function submitReview() {
        const orderId = document.getElementById('review-order-select')?.value;
        const name = document.getElementById('review-name')?.value.trim() || 'Guest';
        const comment = document.getElementById('review-comment')?.value.trim() || '';

        if (!orderId) { App.showToast('Please select an order to review', 'error'); return; }
        if (selectedRating === 0) { App.showToast('Please select a star rating', 'error'); return; }

        const res = await API.createReview({ orderId, customerName: name, rating: selectedRating, comment });
        if (res && res.success) {
            App.showToast('Thank you for your review! ⭐', 'success');
            selectedRating = 0;
            document.getElementById('review-name').value = '';
            document.getElementById('review-comment').value = '';
            document.querySelectorAll('#star-input .star-btn').forEach(b => b.classList.remove('active'));
            await render();
        } else {
            App.showToast(res?.error || 'Could not submit review', 'error');
        }
    }

    async function render() {
        await loadReviews();
        renderSummary();
        await renderList();
        await setupForm();
    }

    function init() {
        const submitBtn = document.getElementById('review-submit-btn');
        if (submitBtn) submitBtn.addEventListener('click', submitReview);
    }

    return { init, render, renderStars };
})();