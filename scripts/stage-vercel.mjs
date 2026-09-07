import { cp, mkdir } from 'node:fs/promises';

// Express deployments serve public/** from the CDN; frontend/public is the source.
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await cp(new URL('../frontend/dist/', import.meta.url), new URL('../public/', import.meta.url), { recursive: true });
