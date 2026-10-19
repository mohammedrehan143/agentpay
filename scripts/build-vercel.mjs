import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoDir = path.join(root, 'apps', 'demo');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');

console.log('Building AgentPay for Vercel deployment...');

// Prepare public directory (default Vercel static output)
await rm(publicDir, { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });
await cp(demoDir, publicDir, { recursive: true });
await cp(demoDir, path.join(publicDir, 'agentpay'), { recursive: true });

// Also prepare dist directory
await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(demoDir, distDir, { recursive: true });
await cp(demoDir, path.join(distDir, 'agentpay'), { recursive: true });

console.log('Vercel build complete: public/ and dist/ ready.');
