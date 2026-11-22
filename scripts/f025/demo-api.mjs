/** Launch the isolated manual TEST slot without relying on shell environment. */
process.env.F025_DEMO_SLOT = 'manual';
await import('./demo-serve.mjs');
