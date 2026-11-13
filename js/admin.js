// admin.js - Admin panel: dashboard, orders, menu CRUD, review moderation
const Admin = (() => {
    let authed = false;
    let activeTab = 'dashboard';

    function isAuthed() { return authed; }

    function showLoginModal() {
        document.getElementById('admin-login-modal')?.classList.remove('hidden');
    }
    function hideLoginModal() {
        document.getElementById('admin-login-modal')?.classList.add('hidden');
    }

    async function login() {
        const pw = document.getElementById('admin-password')?.value;
        if (!pw) return;
        const res = await API.adminLogin(pw);
        if (res && res.success) {
            authed = true;
            sessionStorage.setItem('qs-admin', '1');
            hideLoginModal();
            document.getElementById('admin-password').value = '';
            App.showSection('admin');
            render();
            App.showToast('Welcome, Admin! 🎉', 'success');
        } else {
            App.showToast('Invalid password', 'error');
        }
    }

    function logout() {
        authed = false;
        sessionStorage.removeItem('qs-admin');
        App.showSection('menu');
        App.showToast('Logged out', 'info');
    }

    async function render() {
        if (!authed) return;
        await renderDashboard();
        await renderAdminOrders();
        await renderAdminMenu();
        await renderAdminReviews();
    }

    async function renderDashboard() {
        const el = document.getElementById('admin-stats');
        if (!el) return;
        const stats = await API.getStats();
        if (!stats) { el.innerHTML = '<p class="text-muted">Could not load stats</p>'; return; }
        el.innerHTML = `
            <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-value">${stats.totalOrders}</div><div class="stat-label">Total Orders</div></div>
            <div class="stat-card"><div class="stat-icon">🔥</div><div class="stat-value">${stats.activeOrders}</div><div class="stat-label">Active Orders</div></div>
            <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value">${stats.deliveredOrders}</div><div class="stat-label">Delivered</div></div>
            <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value">${API.formatCurrency(stats.totalRevenue)}</div><div class="stat-label">Revenue</div></div>
            <div class="stat-card"><div class="stat-icon">⭐</div><div class="stat-value">${stats.averageRating}</div><div class="stat-label">Avg Rating (${stats.totalReviews})</div></div>
            <div class="stat-card"><div class="stat-icon">🍽️</div><div class="stat-value">${stats.menuItems}</div><div class="stat-label">Menu Items</div></div>
        `;
    }

    async function renderAdminOrders() {
        const el = document.getElementById('admin-orders-list');
        if (!el) return;
        const orders = await API.getOrders();
        el.innerHTML = `
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead><tr><th>Order ID</th><th>Table</th><th>Items</th><th>Total</th><th>Status</th><th>Change Status</th></tr></thead>
                    <tbody>
                        ${orders.slice().reverse().map(o => `
                            <tr>
                                <td><strong>#${o.id}</strong></td>
                                <td>T-${o.tableNo || '?'}</td>
                                <td>${(o.items || []).length} item(s)</td>
                                <td>${API.formatCurrency(o.total || 0)}</td>
                                <td><span class="status-chip status-${o.status}">${(o.status || '').toUpperCase()}</span></td>
                                <td>
                                    <select class="admin-status-select" data-id="${o.id}">
                                        ${['pending', 'preparing', 'ready', 'delivered'].map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                                    </select>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
        el.querySelectorAll('.admin-status-select').forEach(sel => {
            sel.addEventListener('change', async () => {
                await API.updateOrderStatus(sel.dataset.id, sel.value);
                App.showToast('Status updated', 'success');
                await render();
            });
        });
    }

    async function renderAdminMenu() {
        const el = document.getElementById('admin-menu-list');
        if (!el) return;
        const menu = await API.getMenu();
        el.innerHTML = `
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Veg</th><th>Available</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${menu.map(m => `
                            <tr>
                                <td><strong>${m.name}</strong></td>
                                <td>${m.category}</td>
                                <td>${API.formatCurrency(m.price)}</td>
                                <td>${m.veg ? '🟢 Veg' : '🔴 Non-Veg'}</td>
                                <td><span class="status-chip ${m.available ? 'status-delivered' : 'status-pending'}">${m.available ? 'Yes' : 'Sold Out'}</span></td>
                                <td class="admin-actions">
                                    <button class="btn btn-sm btn-outline toggle-avail" data-id="${m.id}" data-avail="${m.available}">
                                        ${m.available ? 'Mark Out' : 'Mark In'}
                                    </button>
                                    <button class="btn btn-sm btn-outline edit-item" data-id="${m.id}">Edit</button>
                                    <button class="btn btn-sm btn-text text-danger del-item" data-id="${m.id}">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;

        el.querySelectorAll('.toggle-avail').forEach(btn => {
            btn.addEventListener('click', async () => {
                const isAvail = btn.dataset.avail === 'true';
                await API.updateMenuItem(btn.dataset.id, { available: !isAvail });
                App.showToast('Availability updated', 'success');
                await render();
            });
        });
        el.querySelectorAll('.del-item').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this menu item?')) return;
                await API.deleteMenuItem(btn.dataset.id);
                App.showToast('Item deleted', 'info');
                await render();
                if (typeof Menu !== 'undefined') await Menu.init();
            });
        });
        el.querySelectorAll('.edit-item').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(menu.find(x => String(x.id) === btn.dataset.id)));
        });
    }

    function openEditModal(item) {
        if (!item) return;
        const modal = document.getElementById('admin-menu-modal');
        if (!modal) return;
        document.getElementById('mm-id').value = item.id;
        document.getElementById('mm-name').value = item.name;
        document.getElementById('mm-price').value = item.price;
        document.getElementById('mm-category').value = item.category;
        document.getElementById('mm-desc').value = item.description || '';
        document.getElementById('mm-veg').checked = !!item.veg;
        document.getElementById('mm-available').checked = item.available !== false;
        document.getElementById('mm-title').textContent = 'Edit Menu Item';
        modal.classList.remove('hidden');
    }

    function openAddModal() {
        const modal = document.getElementById('admin-menu-modal');
        if (!modal) return;
        document.getElementById('mm-id').value = '';
        document.getElementById('mm-name').value = '';
        document.getElementById('mm-price').value = '';
        document.getElementById('mm-category').value = 'Beverages';
        document.getElementById('mm-desc').value = '';
        document.getElementById('mm-veg').checked = true;
        document.getElementById('mm-available').checked = true;
        document.getElementById('mm-title').textContent = 'Add New Menu Item';
        modal.classList.remove('hidden');
    }

    async function saveMenuItem() {
        const id = document.getElementById('mm-id').value;
        const data = {
            name: document.getElementById('mm-name').value.trim(),
            price: Number(document.getElementById('mm-price').value),
            category: document.getElementById('mm-category').value,
            description: document.getElementById('mm-desc').value.trim(),
            veg: document.getElementById('mm-veg').checked,
            available: document.getElementById('mm-available').checked,
        };
        if (!data.name || !data.price) { App.showToast('Name & price required', 'error'); return; }
        if (id) await API.updateMenuItem(id, data);
        else await API.addMenuItem(data);
        document.getElementById('admin-menu-modal').classList.add('hidden');
        App.showToast(id ? 'Item updated' : 'Item added', 'success');
        await render();
        if (typeof Menu !== 'undefined') await Menu.init();
    }

    async function renderAdminReviews() {
        const el = document.getElementById('admin-reviews-list');
        if (!el) return;
        const reviews = await API.getReviews();
        if (reviews.length === 0) {
            el.innerHTML = '<p class="text-muted">No reviews yet.</p>';
            return;
        }
        el.innerHTML = reviews.slice().reverse().map(r => `
            <div class="admin-review-row">
                <div>
                    <strong>${r.customerName || 'Guest'}</strong>
                    <span class="text-muted"> • Table #${r.tableNo} • ${r.orderId}</span>
                    <div>${Reviews.renderStars(r.rating)}</div>
                    ${r.comment ? `<p>"${r.comment}"</p>` : ''}
                </div>
                <button class="btn btn-sm btn-text text-danger del-review" data-id="${r.id}">Delete</button>
            </div>
        `).join('');
        el.querySelectorAll('.del-review').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this review?')) return;
                await API.deleteReview(btn.dataset.id);
                App.showToast('Review deleted', 'info');
                await render();
            });
        });
    }

    function setupTabs() {
        document.querySelectorAll('.admin-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                activeTab = btn.dataset.tab;
                document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.add('hidden'));
                document.getElementById(`admin-tab-${activeTab}`)?.classList.remove('hidden');
            });
        });
    }

    function init() {
        if (sessionStorage.getItem('qs-admin') === '1') authed = true;

        document.getElementById('admin-btn')?.addEventListener('click', () => {
            if (authed) App.showSection('admin');
            else showLoginModal();
        });
        document.getElementById('admin-login-submit')?.addEventListener('click', login);
        document.getElementById('admin-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
        document.getElementById('admin-login-cancel')?.addEventListener('click', hideLoginModal);
        document.getElementById('admin-logout-btn')?.addEventListener('click', logout);
        document.getElementById('admin-add-menu-btn')?.addEventListener('click', openAddModal);
        document.getElementById('mm-save-btn')?.addEventListener('click', saveMenuItem);
        document.getElementById('mm-cancel-btn')?.addEventListener('click', () => document.getElementById('admin-menu-modal').classList.add('hidden'));
        setupTabs();
    }

    return { init, render, isAuthed, showLoginModal };
})();