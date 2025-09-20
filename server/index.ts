import express from 'express';
import { createServer } from 'http';
import { registerRoutes } from './routes';

const app = express();
const port = process.env.PORT || 3001;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware (for frontend-backend communication)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Express server running (auth via Supabase)' });
});

// Register API routes
registerRoutes(app);

const httpServer = createServer(app);

httpServer.listen(port, () => {
  console.log(`🚀 Express API server running on port ${port}`);
  console.log(`🔐 Authentication handled by Supabase`);
});

export { app };