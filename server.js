const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const root = __dirname;
const databasePath = path.join(root, 'mock', 'db.json');
const configuredPort = process.env.PORT ? Number(process.env.PORT) : 3000;
const allowedStatuses = new Set(['pending', 'preparing', 'ready', 'delivered']);
const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
};

if (!Number.isInteger(configuredPort) || configuredPort < 1 || configuredPort > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
}

let database = JSON.parse(fs.readFileSync(databasePath, 'utf8'));

if (!Array.isArray(database.menu) || !Array.isArray(database.orders)) {
    throw new Error(`Database must contain menu and orders arrays: ${databasePath}`);
}

function sendJson(response, statusCode, data) {
    response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(data));
}

function persistDatabase(nextDatabase) {
    const temporaryPath = `${databasePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporaryPath, `${JSON.stringify(nextDatabase, null, 2)}\n`);
        fs.renameSync(temporaryPath, databasePath);
        database = nextDatabase;
    } catch (error) {
        if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
        throw error;
    }
}

async function readJson(request) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > 1024 * 1024) {
            const error = new Error('Request body exceeds 1 MB');
            error.statusCode = 413;
            throw error;
        }
        chunks.push(chunk);
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        const error = new Error('Request body must be valid JSON');
        error.statusCode = 400;
        throw error;
    }
}

async function handleApi(request, response, pathname) {
    // ---------- MENU ----------
    if (request.method === 'GET' && pathname === '/menu') {
        sendJson(response, 200, database.menu);
        return true;
    }

    if (request.method === 'POST' && pathname === '/menu') {
        const item = await readJson(request);
        if (!item.name || item.price === undefined) {
            sendJson(response, 400, { error: 'Name and price are required' });
            return true;
        }
        const newItem = {
            id: String(Date.now()),
            name: String(item.name).trim(),
            price: Number(item.price),
            category: item.category || 'Main Course',
            description: item.description || '',
            veg: Boolean(item.veg),
            available: item.available !== false,
        };
        persistDatabase({ ...database, menu: [...database.menu, newItem] });
        sendJson(response, 201, newItem);
        return true;
    }

    const menuItemRoute = pathname.match(/^\/menu\/([^/]+)$/);
    if (menuItemRoute && request.method === 'PATCH') {
        const itemId = decodeURIComponent(menuItemRoute[1]);
        const updates = await readJson(request);
        const idx = database.menu.findIndex(i => String(i.id) === itemId);
        if (idx === -1) { sendJson(response, 404, { error: 'Menu item not found' }); return true; }
        const updated = { ...database.menu[idx], ...updates, id: database.menu[idx].id };
        const menu = [...database.menu];
        menu[idx] = updated;
        persistDatabase({ ...database, menu });
        sendJson(response, 200, updated);
        return true;
    }

    if (menuItemRoute && request.method === 'DELETE') {
        const itemId = decodeURIComponent(menuItemRoute[1]);
        const menu = database.menu.filter(i => String(i.id) !== itemId);
        if (menu.length === database.menu.length) { sendJson(response, 404, { error: 'Menu item not found' }); return true; }
        persistDatabase({ ...database, menu });
        sendJson(response, 200, { success: true });
        return true;
    }

    // ---------- TABLES ----------
    if (request.method === 'GET' && pathname === '/tables') {
        const tables = (database.tables || []).map(t => ({ ...t, id: Number(t.id), seats: Number(t.seats) }));
        sendJson(response, 200, tables);
        return true;
    }

    if (request.method === 'GET' && pathname === '/categories') {
        sendJson(response, 200, database.categories || []);
        return true;
    }

    if (request.method === 'GET' && pathname === '/meta') {
        sendJson(response, 200, database.meta || {});
        return true;
    }

    // ---------- ORDERS ----------
    if (request.method === 'GET' && pathname === '/orders') {
        sendJson(response, 200, database.orders);
        return true;
    }

    if (request.method === 'POST' && pathname === '/orders') {
        const order = await readJson(request);
        if (!Array.isArray(order.items) || order.items.length === 0) {
            sendJson(response, 400, { error: 'Order must include at least one item' });
            return true;
        }
        const tableNo = Number(order.tableNo);
        if (!Number.isInteger(tableNo) || tableNo < 1 || tableNo > 15) {
            sendJson(response, 400, { error: 'Order must specify a valid table number (1-15)' });
            return true;
        }
        const calculatedSubtotal = order.items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1), 0);
        const subtotal = Number.isFinite(order.subtotal) ? Number(order.subtotal) : calculatedSubtotal;
        const tax = Number.isFinite(order.tax) ? Number(order.tax) : Math.round(subtotal * 0.05 * 100) / 100;
        const total = Number.isFinite(order.total) ? Number(order.total) : (subtotal + tax);

        const createdOrder = {
            id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
            tableNo,
            status: 'pending',
            items: order.items.map(item => ({
                id: String(item.id || item.menuId || ''),
                name: item.name,
                price: Number(item.price),
                qty: Number(item.qty),
                veg: Boolean(item.veg),
                category: item.category || 'General',
            })),
            subtotal, tax, total,
            paymentMode: order.paymentMode || 'cash',
            notes: order.notes || '',
            createdAt: new Date().toISOString(),
        };
        persistDatabase({ ...database, orders: [...database.orders, createdOrder] });
        sendJson(response, 201, createdOrder);
        return true;
    }

    const orderStatusRoute = pathname.match(/^\/orders\/([^/]+)$/);
    if (request.method === 'PATCH' && orderStatusRoute) {
        const orderId = decodeURIComponent(orderStatusRoute[1]);
        const update = await readJson(request);
        const status = typeof update.status === 'string' ? update.status.toLowerCase().trim() : '';
        if (!allowedStatuses.has(status)) {
            sendJson(response, 400, { error: `Invalid order status. Allowed: ${Array.from(allowedStatuses).join(', ')}` });
            return true;
        }
        const orderIndex = database.orders.findIndex(order => String(order.id) === orderId);
        if (orderIndex === -1) { sendJson(response, 404, { error: 'Order not found' }); return true; }
        const orders = database.orders.map((order, index) => index === orderIndex ? { ...order, status } : order);
        persistDatabase({ ...database, orders });
        sendJson(response, 200, orders[orderIndex]);
        return true;
    }

    // ---------- REVIEWS ----------
    if (request.method === 'GET' && pathname === '/reviews') {
        sendJson(response, 200, database.reviews || []);
        return true;
    }

    if (request.method === 'POST' && pathname === '/reviews') {
        const review = await readJson(request);
        const rating = Number(review.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            sendJson(response, 400, { error: 'Rating must be between 1 and 5' });
            return true;
        }
        const orderId = String(review.orderId || '').trim();
        if (!orderId) { sendJson(response, 400, { error: 'Order ID is required' }); return true; }
        const order = database.orders.find(o => String(o.id) === orderId);
        if (!order) { sendJson(response, 404, { error: 'Order not found' }); return true; }
        if (String(order.status).toLowerCase() !== 'delivered') {
            sendJson(response, 400, { error: 'Only delivered orders can be reviewed' });
            return true;
        }
        const existing = (database.reviews || []).find(r => String(r.orderId) === orderId);
        if (existing) { sendJson(response, 409, { error: 'This order has already been reviewed' }); return true; }

        const newReview = {
            id: `REV-${Date.now()}`,
            orderId,
            tableNo: Number(order.tableNo),
            customerName: String(review.customerName || 'Guest').trim().slice(0, 60),
            rating,
            comment: String(review.comment || '').trim().slice(0, 500),
            itemNames: (order.items || []).map(i => i.name),
            createdAt: new Date().toISOString(),
        };
        persistDatabase({ ...database, reviews: [...(database.reviews || []), newReview] });
        sendJson(response, 201, newReview);
        return true;
    }

    const reviewDeleteRoute = pathname.match(/^\/reviews\/([^/]+)$/);
    if (request.method === 'DELETE' && reviewDeleteRoute) {
        const reviewId = decodeURIComponent(reviewDeleteRoute[1]);
        const reviews = (database.reviews || []).filter(r => String(r.id) !== reviewId);
        if (reviews.length === (database.reviews || []).length) {
            sendJson(response, 404, { error: 'Review not found' }); return true;
        }
        persistDatabase({ ...database, reviews });
        sendJson(response, 200, { success: true });
        return true;
    }

    // ---------- ADMIN ----------
    if (request.method === 'POST' && pathname === '/admin/login') {
        const body = await readJson(request);
        const password = String(body.password || '');
        const expected = (database.meta && database.meta.adminPassword) || 'admin123';
        if (password === expected) {
            sendJson(response, 200, { success: true, token: 'admin-session' });
        } else {
            sendJson(response, 401, { error: 'Invalid password' });
        }
        return true;
    }

    if (request.method === 'GET' && pathname === '/stats') {
        const orders = database.orders;
        const reviews = database.reviews || [];
        const delivered = orders.filter(o => String(o.status).toLowerCase() === 'delivered');
        const active = orders.filter(o => ['pending', 'preparing', 'ready'].includes(String(o.status).toLowerCase()));
        const revenue = delivered.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        const avgRating = reviews.length > 0
            ? reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviews.length
            : 0;
        sendJson(response, 200, {
            totalOrders: orders.length,
            activeOrders: active.length,
            deliveredOrders: delivered.length,
            totalRevenue: Math.round(revenue * 100) / 100,
            totalReviews: reviews.length,
            averageRating: Math.round(avgRating * 10) / 10,
            menuItems: database.menu.length,
            tables: (database.tables || []).length,
        });
        return true;
    }

    const knownPaths = ['/menu', '/tables', '/categories', '/meta', '/orders', '/reviews', '/stats', '/admin/login'];
    if (knownPaths.includes(pathname) || pathname.startsWith('/orders/') || pathname.startsWith('/reviews/') || pathname.startsWith('/menu/')) {
        sendJson(response, 405, { error: 'Method not allowed' });
        return true;
    }

    return false;
}

async function serveStatic(request, response, pathname) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendJson(response, 405, { error: 'Method not allowed' });
        return;
    }
    const relativeUrlPath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.resolve(root, `.${relativeUrlPath}`);
    const relativePath = path.relative(root, filePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        sendJson(response, 404, { error: 'Not found' });
        return;
    }
    let file;
    try {
        file = await fs.promises.readFile(filePath);
    } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'EISDIR') {
            sendJson(response, 404, { error: 'Not found' });
            return;
        }
        throw error;
    }
    response.writeHead(200, {
        'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : file);
}

const server = http.createServer(async (request, response) => {
    try {
        const url = new URL(request.url, 'http://localhost');
        const pathname = decodeURIComponent(url.pathname);
        const handled = await handleApi(request, response, pathname);
        if (!handled) await serveStatic(request, response, pathname);
    } catch (error) {
        if (response.headersSent) { response.destroy(error); return; }
        if (error.statusCode) { sendJson(response, error.statusCode, { error: error.message }); return; }
        console.error('Request failed:', error);
        sendJson(response, 500, { error: 'Internal server error' });
    }
});

function listen(port) {
    const onListening = () => {
        console.log(`QuickServe running at http://localhost:${server.address().port}`);
    };
    server.once('error', error => {
        server.removeListener('listening', onListening);
        if (error.code === 'EADDRINUSE' && !process.env.PORT && port < 65535) {
            console.warn(`Port ${port} busy; trying ${port + 1}`);
            listen(port + 1);
            return;
        }
        console.error(`Unable to start QuickServe on port ${port}:`, error.message);
        process.exitCode = 1;
    });
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
}

if (require.main === module) listen(configuredPort);

module.exports = { server, handleApi, serveStatic, listen };