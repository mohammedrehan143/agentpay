import express from 'express';
import { registerAgentPayRoutes } from '../apps/reference-server/src/agentpay.js';

if (!Object.hasOwn(process.env, 'AGENTPAY_RECORDED')) process.env.AGENTPAY_RECORDED = '1';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
registerAgentPayRoutes(app);

export default app;
