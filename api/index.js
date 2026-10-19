import express from 'express';
import { registerAgentPayRoutes } from '../apps/reference-server/src/agentpay.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
registerAgentPayRoutes(app);

export default app;
