/**
 * LTK Auth Middleware Server
 *
 * Express server providing:
 * - Plaid-style LTK connection flow
 * - Encrypted token storage
 * - API proxy to LTK
 * - Background token refresh
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import ltkAuthRoutes from './routes/ltkAuth.js';
import ltkProxyRoutes from './routes/ltkProxy.js';
import ltkEarningsRoutes from './routes/ltkEarnings.js';
import mavelyAuthRoutes from './routes/mavelyAuth.js';
import scheduledJobsRoutes from './routes/scheduledJobs.js';
import { startTokenRefreshJob } from './services/tokenRefresh.js';
import { startScheduledDataExtraction } from './services/scheduledExtraction.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
  credentials: true,
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/ltk', ltkAuthRoutes);

// LTK Earnings/Analytics routes
app.use('/api/ltk', ltkEarningsRoutes);

// LTK API Proxy routes
app.use('/api/ltk', ltkProxyRoutes);

// Mavely Authentication and Data Extraction routes
app.use('/api/mavely', mavelyAuthRoutes);

// Scheduled Jobs Management routes
app.use('/api/scheduled', scheduledJobsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
║   🔐 Multi-Platform Auth Middleware                           ║
║                                                               ║
║   Server running on port ${PORT}                                ║
║                                                               ║
║   LTK Endpoints:                                              ║
║   • POST /api/ltk/connect          Connect LTK account        ║
║   • GET  /api/ltk/status/:userId   Check connection           ║
║   • POST /api/ltk/refresh/:userId  Refresh tokens             ║
║   • DELETE /api/ltk/disconnect/:userId  Disconnect            ║
║   • GET  /api/ltk/earnings/:userId Fetch LTK earnings         ║
║   • GET  /api/ltk/analytics/:userId Fetch LTK analytics       ║
║   • GET  /api/ltk/*                Proxy to LTK API           ║
║                                                               ║
║   Mavely Endpoints:                                           ║
║   • POST /api/mavely/connect       Connect Mavely account     ║
║   • GET  /api/mavely/status/:userId Check connection          ║
║   • DELETE /api/mavely/disconnect/:userId Disconnect          ║
║   • POST /api/mavely/extract/:userId Extract analytics        ║
║   • POST /api/mavely/export-csv/:userId Export CSV            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
  
  // Start background token refresh job
  startTokenRefreshJob();
  
  // Start scheduled data extraction job
  startScheduledDataExtraction();
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
