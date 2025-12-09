"use strict";
/**
 * LTK Auth Middleware Server
 *
 * Express server providing:
 * - Plaid-style LTK connection flow
 * - Encrypted token storage
 * - API proxy to LTK
 * - Background token refresh
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const ltkAuth_js_1 = __importDefault(require("./routes/ltkAuth.js"));
const ltkProxy_js_1 = __importDefault(require("./routes/ltkProxy.js"));
const ltkEarnings_js_1 = __importDefault(require("./routes/ltkEarnings.js"));
const tokenRefresh_js_1 = require("./services/tokenRefresh.js");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Security middleware
app.use((0, helmet_1.default)());
// CORS configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
    credentials: true,
};
app.use((0, cors_1.default)(corsOptions));
// Body parsing
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Request logging (simple)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});
// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});
// LTK Authentication routes (connect/disconnect)
app.use('/api/ltk', ltkAuth_js_1.default);
// LTK Earnings/Analytics routes
app.use('/api/ltk', ltkEarnings_js_1.default);
// LTK API Proxy routes
app.use('/api/ltk', ltkProxy_js_1.default);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        path: req.path,
    });
});
// Error handler
app.use((err, req, res, next) => {
    console.error('[Error]', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});
// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🔐 LTK Auth Middleware                                      ║
║                                                               ║
║   Server running on port ${PORT}                                ║
║                                                               ║
║   Endpoints:                                                  ║
║   • POST /api/ltk/connect          Connect LTK account        ║
║   • GET  /api/ltk/status/:userId   Check connection           ║
║   • POST /api/ltk/refresh/:userId  Refresh tokens             ║
║   • DELETE /api/ltk/disconnect/:userId  Disconnect            ║
║   • GET  /api/ltk/earnings/:userId Fetch LTK earnings         ║
║   • GET  /api/ltk/analytics/:userId Fetch LTK analytics       ║
║   • GET  /api/ltk/*                Proxy to LTK API           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
    // Start background token refresh job
    (0, tokenRefresh_js_1.startTokenRefreshJob)();
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down...');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('[Server] SIGINT received, shutting down...');
    process.exit(0);
});
//# sourceMappingURL=index.js.map