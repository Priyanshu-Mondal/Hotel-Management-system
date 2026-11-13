// api.js - Service layer handling AJAX, REST APIs, and offline fallback
const API = (() => {
    const BASE_URL = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
    let isServerReachable = true;
    const statusListeners = [];

    const currencyFormatter = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    });

    function formatCurrency(amount) {
        const num = Number(amount) || 0;
        return currencyFormatter.format(num);
    }

    function setServerStatus(online) {
        if (isServerReachable !== online) {
            isServerReachable = online;
            statusListeners.forEach(fn => fn(online));
        }
    }

    function onConnectionChange(fn) {
        statusListeners.push(fn);
        fn(isServerReachable);
    }

    async function request(path, options = {}) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const res = await fetch(`${BASE_URL}${path}`, {
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                ...options,
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const err = new Error(errData.error || `HTTP ${res.status}`);
                err.status = res.status;
                err.data = errData;
                throw err;
            }

            setServerStatus(true);
            return await res.json();
        } catch (err) {
            console.warn(`[QuickServe API] AJAX failed for ${path}:`, err.message);
            setServerStatus(false);
            // Attach error info so callers can decide on fallback
            return null;
        }
    }

    // Default 15 Tables matching café specs
    const DEFAULT_TABLES = [
        { id: 1, seats: 2, location: 'Window' },
        { id: 2, seats: 2, location: 'Window' },
        { id: 3, seats: 4, location: 'Center' },
        { id: 4, seats: 4, location: 'Center' },
        { id: 5, seats: 4, location: 'Center' },
        { id: 6, seats: 6, location: 'Corner' },
        { id: 7, seats: 2, location: 'Window' },
        { id: 8, seats: 4, location: 'Center' },
        { id: 9, seats: 4, location: 'Center' },
        { id: 10, seats: 6, location: 'Corner' },
        { id: 11, seats: 2, location: 'Window' },
        { id: 12, seats: 4, location: 'Center' },
        { id: 13, seats: 4, location: 'Center' },
        { id: 14, seats: 6, location: 'Corner' },
        { id: 15, seats: 2, location: 'Window' },
    ];

    // Seed Menu matching QuickServe Café Indian specialties
    const DEFAULT_MENU = [
        { id: '1', name: 'Masala Chai', price: 30, category: 'Beverages', description: 'Authentic brewed Indian tea with ginger and cardamom', veg: true, available: true },
        { id: '2', name: 'Filter Coffee', price: 40, category: 'Beverages', description: 'Traditional South Indian frothy decoction coffee', veg: true, available: true },
        { id: '3', name: 'Cold Coffee', price: 90, category: 'Beverages', description: 'Rich blended iced coffee topped with chocolate drizzle', veg: true, available: true },
        { id: '4', name: 'Fresh Lime Soda', price: 60, category: 'Beverages', description: 'Refreshing sparkling lime with sweet or salted mix', veg: true, available: true },
        { id: '5', name: 'Lassi (Sweet)', price: 70, category: 'Beverages', description: 'Thick creamy churned yogurt sweetened with saffron essence', veg: true, available: true },
        { id: '6', name: 'Samosa (2 pcs)', price: 40, category: 'Snacks', description: 'Crispy fried pastry filled with spiced potato and green peas', veg: true, available: true },
        { id: '7', name: 'Vada Pav', price: 35, category: 'Snacks', description: 'Mumbai special spiced batata vada inside buttered pav with chutney', veg: true, available: true },
        { id: '8', name: 'Pav Bhaji', price: 120, category: 'Snacks', description: 'Mashed spiced vegetable curry served with toasted butter buns', veg: true, available: true },
        { id: '9', name: 'Paneer Tikka', price: 220, category: 'Snacks', description: 'Clay-oven roasted cottage cheese cubes marinated in tandoori spices', veg: true, available: true },
        { id: '10', name: 'Chicken 65', price: 260, category: 'Snacks', description: 'Deep-fried spicy chicken bites seasoned with curry leaves and red chilies', veg: false, available: true },
        { id: '11', name: 'Masala Dosa', price: 110, category: 'South Indian', description: 'Crisp fermented crepe stuffed with seasoned potato mash, served with sambar', veg: true, available: true },
        { id: '12', name: 'Idli Sambar (3 pcs)', price: 80, category: 'South Indian', description: 'Steamed rice cakes served piping hot with lentil stew and coconut chutney', veg: true, available: true },
        { id: '13', name: 'Medu Vada (2 pcs)', price: 70, category: 'South Indian', description: 'Crispy golden lentil fritters paired with spiced tangy sambar', veg: true, available: true },
        { id: '14', name: 'Rava Upma', price: 90, category: 'South Indian', description: 'Roasted semolina porridge tempered with mustard seeds and curry leaves', veg: true, available: true },
        { id: '15', name: 'Veg Thali', price: 250, category: 'Main Course', description: 'Complete meal: Paneer sabzi, dal tadka, rice, 2 rotis, salad & sweet', veg: true, available: true },
        { id: '16', name: 'Chicken Biryani', price: 320, category: 'Main Course', description: 'Aromatic basmati rice cooked with tender marinated chicken and spices', veg: false, available: true },
        { id: '17', name: 'Paneer Butter Masala', price: 280, category: 'Main Course', description: 'Cottage cheese chunks simmered in a creamy tomato-cashew butter gravy', veg: true, available: true },
        { id: '18', name: 'Veg Fried Rice', price: 180, category: 'Main Course', description: 'Wok-tossed basmati rice with finely diced seasonal veggies and soy seasoning', veg: true, available: true },
        { id: '19', name: 'Hakka Noodles', price: 170, category: 'Main Course', description: 'Stir-fried noodles with crunchy cabbage, bell peppers and mild chili garlic sauce', veg: true, available: true },
        { id: '20', name: 'Butter Naan + Dal', price: 200, category: 'Main Course', description: 'Two tandoor butter naans served with slow-cooked homestyle yellow dal', veg: true, available: true },
        { id: '21', name: 'Gulab Jamun (2 pcs)', price: 60, category: 'Desserts', description: 'Warm milk-solid dumplings soaked in rose and cardamom sugar syrup', veg: true, available: true },
        { id: '22', name: 'Gajar Halwa', price: 90, category: 'Desserts', description: 'Grated red carrots slow cooked in whole milk, ghee, and roasted dry fruits', veg: true, available: true },
        { id: '23', name: 'Rasmalai (2 pcs)', price: 80, category: 'Desserts', description: 'Soft cottage cheese patties immersed in saffron and pistachio infused milk', veg: true, available: true },
        { id: '24', name: 'Filter Coffee Ice Cream', price: 100, category: 'Desserts', description: 'Signature artisanal churned ice cream infused with South Indian filter roast', veg: true, available: false }
    ];

    const DEFAULT_ORDERS = [
        {
            id: 'ORD-1001',
            tableNo: 3,
            status: 'pending',
            items: [
                { id: '11', name: 'Masala Dosa', price: 110, qty: 2, veg: true, category: 'South Indian' },
                { id: '1', name: 'Masala Chai', price: 30, qty: 2, veg: true, category: 'Beverages' }
            ],
            subtotal: 280,
            tax: 14,
            total: 294,
            paymentMode: 'cash',
            notes: '',
            createdAt: new Date(Date.now() - 25 * 60000).toISOString()
        },
        {
            id: 'ORD-1002',
            tableNo: 7,
            status: 'preparing',
            items: [
                { id: '16', name: 'Chicken Biryani', price: 320, qty: 1, veg: false, category: 'Main Course' },
                { id: '3', name: 'Cold Coffee', price: 90, qty: 1, veg: true, category: 'Beverages' }
            ],
            subtotal: 410,
            tax: 20.5,
            total: 430.5,
            paymentMode: 'upi',
            notes: '',
            createdAt: new Date(Date.now() - 15 * 60000).toISOString()
        },
        {
            id: 'ORD-1003',
            tableNo: 12,
            status: 'ready',
            items: [
                { id: '8', name: 'Pav Bhaji', price: 120, qty: 1, veg: true, category: 'Snacks' },
                { id: '21', name: 'Gulab Jamun (2 pcs)', price: 60, qty: 1, veg: true, category: 'Desserts' }
            ],
            subtotal: 180,
            tax: 9,
            total: 189,
            paymentMode: 'card',
            notes: '',
            createdAt: new Date(Date.now() - 8 * 60000).toISOString()
        },
        {
            id: 'ORD-1004',
            tableNo: 1,
            status: 'delivered',
            items: [
                { id: '6', name: 'Samosa (2 pcs)', price: 40, qty: 2, veg: true, category: 'Snacks' },
                { id: '2', name: 'Filter Coffee', price: 40, qty: 2, veg: true, category: 'Beverages' }
            ],
            subtotal: 160,
            tax: 8,
            total: 168,
            paymentMode: 'cash',
            notes: '',
            createdAt: new Date(Date.now() - 40 * 60000).toISOString()
        }
    ];

    // ---------- LocalStorage helpers ----------
    function getStoredOrders() {
        const raw = localStorage.getItem('quickserve-orders');
        if (!raw) {
            localStorage.setItem('quickserve-orders', JSON.stringify(DEFAULT_ORDERS));
            return DEFAULT_ORDERS;
        }
        try {
            return JSON.parse(raw);
        } catch {
            return DEFAULT_ORDERS;
        }
    }

    function saveStoredOrders(orders) {
        localStorage.setItem('quickserve-orders', JSON.stringify(orders));
    }

    function getStoredMenu() {
        const raw = localStorage.getItem('quickserve-menu');
        if (!raw) {
            localStorage.setItem('quickserve-menu', JSON.stringify(DEFAULT_MENU));
            return DEFAULT_MENU;
        }
        try {
            return JSON.parse(raw);
        } catch {
            return DEFAULT_MENU;
        }
    }

    function saveStoredMenu(menu) {
        localStorage.setItem('quickserve-menu', JSON.stringify(menu));
    }

    function getStoredReviews() {
        try {
            return JSON.parse(localStorage.getItem('quickserve-reviews') || '[]');
        } catch {
            return [];
        }
    }

    function saveStoredReviews(reviews) {
        localStorage.setItem('quickserve-reviews', JSON.stringify(reviews));
    }

    // ============================================================
    //  MENU
    // ============================================================
    async function getMenu() {
        const data = await request('/menu');
        if (data && Array.isArray(data)) {
            saveStoredMenu(data);
            return data;
        }
        return getStoredMenu();
    }

    async function addMenuItem(item) {
        const result = await request('/menu', {
            method: 'POST',
            body: JSON.stringify(item),
        });
        if (result && !result.error) {
            const menu = getStoredMenu();
            menu.push(result);
            saveStoredMenu(menu);
            return result;
        }
        // Offline fallback
        const menu = getStoredMenu();
        const newItem = {
            id: String(Date.now()),
            name: String(item.name || '').trim(),
            price: Number(item.price) || 0,
            category: item.category || 'Main Course',
            description: item.description || '',
            veg: Boolean(item.veg),
            available: item.available !== false,
        };
        menu.push(newItem);
        saveStoredMenu(menu);
        return newItem;
    }

    async function updateMenuItem(id, updates) {
        const result = await request(`/menu/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
        const menu = getStoredMenu();
        const idx = menu.findIndex(m => String(m.id) === String(id));
        if (idx !== -1) {
            menu[idx] = { ...menu[idx], ...updates, id: menu[idx].id };
            saveStoredMenu(menu);
        }
        if (result && !result.error) return result;
        return idx !== -1 ? menu[idx] : null;
    }

    async function deleteMenuItem(id) {
        const result = await request(`/menu/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        });
        const menu = getStoredMenu().filter(m => String(m.id) !== String(id));
        saveStoredMenu(menu);
        return result || { success: true, offline: true };
    }

    // ============================================================
    //  TABLES
    // ============================================================
    async function getTables() {
        const data = await request('/tables');
        if (data && Array.isArray(data)) return data;
        return DEFAULT_TABLES;
    }

    // ============================================================
    //  ORDERS
    // ============================================================
    async function getOrders() {
        const data = await request('/orders');
        if (data && Array.isArray(data)) {
            saveStoredOrders(data);
            return data;
        }
        return getStoredOrders();
    }

    async function createOrder(orderPayload) {
        const serverResult = await request('/orders', {
            method: 'POST',
            body: JSON.stringify(orderPayload),
        });

        if (serverResult && !serverResult.error) {
            const orders = getStoredOrders();
            orders.unshift(serverResult);
            saveStoredOrders(orders);
            return { success: true, order: serverResult, offline: false };
        }

        // Offline fallback
        const orders = getStoredOrders();
        const randId = Math.floor(1000 + Math.random() * 9000);
        const subtotal = orderPayload.subtotal || orderPayload.items.reduce((s, i) => s + i.price * i.qty, 0);
        const tax = Math.round(subtotal * 0.05 * 100) / 100;
        const total = Math.round((subtotal + tax) * 100) / 100;

        const fallbackOrder = {
            id: `ORD-${randId}`,
            tableNo: Number(orderPayload.tableNo) || 1,
            status: 'pending',
            items: orderPayload.items,
            subtotal,
            tax,
            total,
            paymentMode: orderPayload.paymentMode || 'cash',
            notes: orderPayload.notes || '',
            createdAt: new Date().toISOString(),
        };

        orders.unshift(fallbackOrder);
        saveStoredOrders(orders);
        return { success: true, order: fallbackOrder, offline: true };
    }

    async function updateOrderStatus(orderId, status) {
        const normalizedStatus = String(status).toLowerCase().trim();
        const serverResult = await request(`/orders/${encodeURIComponent(orderId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: normalizedStatus }),
        });

        const orders = getStoredOrders();
        const idx = orders.findIndex(o => String(o.id) === String(orderId));
        if (idx !== -1) {
            orders[idx].status = normalizedStatus;
            saveStoredOrders(orders);
        }

        if (serverResult && !serverResult.error) {
            return { success: true, order: serverResult, offline: false };
        }

        if (idx !== -1) {
            return { success: true, order: orders[idx], offline: true };
        }

        return { success: false, error: 'Order not found' };
    }

    // ============================================================
    //  REVIEWS
    // ============================================================
    async function getReviews() {
        const data = await request('/reviews');
        if (Array.isArray(data)) {
            saveStoredReviews(data);
            return data;
        }
        return getStoredReviews();
    }

    async function createReview(payload) {
        // Local validation first (mirrors server)
        const rating = Number(payload.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return { success: false, error: 'Rating must be between 1 and 5' };
        }
        if (!payload.orderId) {
            return { success: false, error: 'Order ID is required' };
        }

        const serverResult = await request('/reviews', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        if (serverResult && !serverResult.error) {
            const reviews = getStoredReviews();
            reviews.push(serverResult);
            saveStoredReviews(reviews);
            return { success: true, review: serverResult, offline: false };
        }

        // Offline fallback — still enforce order-exists + delivered + not-duplicate
        const orders = getStoredOrders();
        const order = orders.find(o => String(o.id) === String(payload.orderId));
        if (!order) return { success: false, error: 'Order not found' };
        if (String(order.status).toLowerCase() !== 'delivered') {
            return { success: false, error: 'Only delivered orders can be reviewed' };
        }
        const reviews = getStoredReviews();
        if (reviews.some(r => String(r.orderId) === String(payload.orderId))) {
            return { success: false, error: 'This order has already been reviewed' };
        }

        const review = {
            id: `REV-${Date.now()}`,
            orderId: String(payload.orderId),
            tableNo: Number(order.tableNo),
            customerName: String(payload.customerName || 'Guest').trim().slice(0, 60),
            rating,
            comment: String(payload.comment || '').trim().slice(0, 500),
            itemNames: (order.items || []).map(i => i.name),
            createdAt: new Date().toISOString(),
        };
        reviews.push(review);
        saveStoredReviews(reviews);
        return { success: true, review, offline: true };
    }

    async function deleteReview(id) {
        const result = await request(`/reviews/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        });
        const reviews = getStoredReviews().filter(r => String(r.id) !== String(id));
        saveStoredReviews(reviews);
        return result || { success: true, offline: true };
    }

    // ============================================================
    //  ADMIN
    // ============================================================
    async function adminLogin(password) {
        const result = await request('/admin/login', {
            method: 'POST',
            body: JSON.stringify({ password }),
        });
        if (result) return result;
        // Offline fallback
        if (String(password) === 'admin123') {
            return { success: true, token: 'offline-session', offline: true };
        }
        return { success: false, error: 'Invalid password' };
    }

    async function getStats() {
        const data = await request('/stats');
        if (data && typeof data === 'object' && !data.error) return data;
        // Compute offline stats from localStorage
        const orders = getStoredOrders();
        const reviews = getStoredReviews();
        const menu = getStoredMenu();
        const delivered = orders.filter(o => String(o.status).toLowerCase() === 'delivered');
        const active = orders.filter(o => ['pending', 'preparing', 'ready'].includes(String(o.status).toLowerCase()));
        const revenue = delivered.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        const avgRating = reviews.length
            ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length
            : 0;
        return {
            totalOrders: orders.length,
            activeOrders: active.length,
            deliveredOrders: delivered.length,
            totalRevenue: Math.round(revenue * 100) / 100,
            totalReviews: reviews.length,
            averageRating: Math.round(avgRating * 10) / 10,
            menuItems: menu.length,
            tables: DEFAULT_TABLES.length,
        };
    }

    // ============================================================
    //  Public API surface
    // ============================================================
    return {
        // Menu
        getMenu,
        addMenuItem,
        updateMenuItem,
        deleteMenuItem,
        // Tables
        getTables,
        // Orders
        getOrders,
        createOrder,
        updateOrderStatus,
        // Reviews
        getReviews,
        createReview,
        deleteReview,
        // Admin
        adminLogin,
        getStats,
        // Utilities
        formatCurrency,
        onConnectionChange,
        isOnline: () => isServerReachable,
    };
})();