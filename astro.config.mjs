import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://www.gta6state.com',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  vite: {
    plugins: [tailwindcss()],
  },
  image: {
    domains: [],
    remotePatterns: [{ protocol: 'https' }, { protocol: 'http' }],
  },
  env: {
    schema: {
      SITE_URL: envField.string({
        context: 'server',
        access: 'public',
        default: 'https://www.gta6state.com',
      }),
      SITE_NAME: envField.string({ context: 'server', access: 'public', default: 'GTA6State' }),
      PAYLOAD_URL: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      PAYLOAD_PUBLIC_URL: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
      }),
      PAYLOAD_STATIC_TOKEN: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
    },
  },
});

