import type { VercelConfig } from '@vercel/config/v1';

/** Type-checked Vercel configuration for the Expo static web export. */
export const config: VercelConfig = {
  buildCommand: 'npm run web:build',
  outputDirectory: 'dist',
  framework: null,
  installCommand: 'npm ci',
  rewrites: [
    {
      source: '/((?!_expo|assets|favicon|.*\\.[a-zA-Z0-9]+$).*)',
      destination: '/index.html',
    },
  ],
};
