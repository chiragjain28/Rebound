"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const websocket_1 = require("./websocket");
// Route imports
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const visit_routes_1 = __importDefault(require("./routes/visit.routes"));
const session_routes_1 = __importDefault(require("./routes/session.routes"));
const menu_routes_1 = __importDefault(require("./routes/menu.routes"));
const order_routes_1 = __importDefault(require("./routes/order.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const tableBooking_routes_1 = __importDefault(require("./routes/tableBooking.routes"));
const credit_routes_1 = __importDefault(require("./routes/credit.routes"));
const udhar_routes_1 = __importDefault(require("./routes/udhar.routes"));
const table_routes_1 = __importDefault(require("./routes/table.routes"));
const customer_routes_1 = __importDefault(require("./routes/customer.routes"));
// Load .env.local first (dev overrides), then fallback to .env (prod defaults)
dotenv_1.default.config({ path: '.env.local', override: true });
if (process.env.DATABASE_URL?.includes('<your-dev-project>')) {
    delete process.env.DATABASE_URL;
}
if (process.env.DIRECT_URL?.includes('<your-dev-project>')) {
    delete process.env.DIRECT_URL;
}
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const port = process.env.PORT || 3001;
const prismaClient = new client_1.PrismaClient();
exports.prisma = prismaClient.$extends({
    query: {
        async $allOperations({ model, operation, args, query }) {
            const start = Date.now();
            const result = await query(args);
            const duration = Date.now() - start;
            console.log(`[PRISMA] ${model || 'Database'}.${operation} took ${duration}ms`);
            return result;
        },
    },
});
// CORS — allow frontend origin from env var (set on Render)
const allowedOrigins = [
    'https://rebound-taupe-theta.vercel.app', // production frontend
    process.env.FRONTEND_URL, // from Render env var
].filter(Boolean);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) {
            return callback(null, true);
        }
        // Allow any localhost port for local development
        if (/^http:\/\/localhost:\d+$/.test(origin)) {
            return callback(null, true);
        }
        // Allow known production origins
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
}));
app.use(express_1.default.json());
// Routes setup
app.use('/api/auth', auth_routes_1.default);
app.use('/api/dashboard', dashboard_routes_1.default);
app.use('/api/visits', visit_routes_1.default);
app.use('/api/sessions', session_routes_1.default);
app.use('/api/menu', menu_routes_1.default);
app.use('/api/orders', order_routes_1.default);
app.use('/api/payments', payment_routes_1.default);
app.use('/api/bookings', tableBooking_routes_1.default);
app.use('/api/credits', credit_routes_1.default);
app.use('/api/udhar', udhar_routes_1.default);
app.use('/api/tables', table_routes_1.default);
app.use('/api/customers', customer_routes_1.default);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', time: new Date() });
});
// Initialize WebSocket server
(0, websocket_1.initWebSocket)(server);
server.listen(port, () => {
    console.log(`Rebound ERP Backend listening on http://localhost:${port}`);
});
// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    try {
        // Stop accepting new connections
        server.close(() => {
            console.log('HTTP server closed.');
        });
        // Disconnect Prisma
        await exports.prisma.$disconnect();
        console.log('Prisma disconnected successfully.');
        process.exit(0);
    }
    catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
};
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon restarts
