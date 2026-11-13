// app.js - Main Application Controller, Navigation, and Global Services
const App = (() => {
    const sections = {
        menu: document.getElementById('menu-section'),
        cart: document.getElementById('cart-section'),
        orders: document.getElementById('orders-section'),
        tables: document.getElementById('tables-section'),
        reviews: document.getElementById('reviews-section'),
        admin: document.getElementById('admin-section'),
    };

    const navButtons = {
        menu: document.getElementById('menu-btn'),
        cart: document.getElementById('cart-btn'),
        orders: document.getElementById('orders-btn'),
        tables: document.getElementById('tables-btn'),
        reviews: document.getElementById('reviews-btn'),
    };

    function showSection(name) {
        if (!sections[name]) return;

        // Admin guard
        if (name === 'admin' && typeof Admin !== 'undefined' && !Admin.isAuthed()) {
            Admin.showLoginModal();
            return;
        }

        Object.entries(sections).forEach(([key, el]) => {
            if (el) el.classList.toggle('hidden', key !== name);
        });

        Object.entries(navButtons).forEach(([key, btn]) => {
            if (btn) btn.classList.toggle('active', key === name);
        });

        if (name === 'cart') {
            Cart.render();
        } else if (name === 'orders') {
            Orders.refresh();
        } else if (name === 'tables') {
            Tables.render();
        } else if (name === 'menu') {
            Menu.renderItems();
        } else if (name === 'reviews') {
            Reviews.render();
        } else if (name === 'admin') {
            Admin.render();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast-message toast-${type}`;

        const icons = { success: '✓', error: '✕', info: 'ℹ' };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || 'ℹ'}</span>
            <span class="toast-text">${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    function setupNavigation() {
        if (navButtons.menu) navButtons.menu.addEventListener('click', () => showSection('menu'));
        if (navButtons.cart) navButtons.cart.addEventListener('click', () => showSection('cart'));
        if (navButtons.orders) navButtons.orders.addEventListener('click', () => showSection('orders'));
        if (navButtons.tables) navButtons.tables.addEventListener('click', () => showSection('tables'));
        if (navButtons.reviews) navButtons.reviews.addEventListener('click', () => showSection('reviews'));
    }

    function setupConnectionWatcher() {
        const indicator = document.getElementById('connection-status');
        if (!indicator) return;

        API.onConnectionChange((isOnline) => {
            if (isOnline) {
                indicator.className = 'status-indicator online';
                indicator.querySelector('.status-label').textContent = 'Live Server';
                indicator.title = 'Connected to QuickServe Node.js backend';
            } else {
                indicator.className = 'status-indicator offline';
                indicator.querySelector('.status-label').textContent = 'Offline Mock';
                indicator.title = 'Running on browser local storage fallback';
            }
        });
    }

    async function init() {
        setupNavigation();
        setupConnectionWatcher();

        await Tables.init();
        await Menu.init();
        Cart.init();
        Orders.init();
        Reviews.init();
        Admin.init();

        showSection('menu');
    }

    return { init, showSection, showToast };
})();

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});