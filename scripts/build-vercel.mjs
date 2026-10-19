import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoDir = path.join(root, 'apps', 'demo');
const distDir = path.join(root, 'dist');
const distAgentpayDir = path.join(distDir, 'agentpay');

console.log('Building AgentPay for Vercel deployment...');

// Clean dist
await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

// Copy demo to root of dist
await cp(demoDir, distDir, { recursive: true });

// Also copy demo to dist/agentpay for compatibility with /agentpay/ URLs
await cp(demoDir, distAgentpayDir, { recursive: true });

console.log('Vercel build complete: dist/ ready.');
