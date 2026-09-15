import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  // Disable in dev to avoid SW cache pain durante desarrollo
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // El modulo Suelo paso a llamarse Documentacion. Quien tenga un marcador
      // viejo —o la PWA instalada con el atajo anterior— llegaria a un 404.
      { source: '/suelo', destination: '/documentacion', permanent: true },
      // /dashboard se elimino (15-sep-2026): /cultivo pasa a ser la pantalla
      // de entrada. start_url del manifest ya apunta ahi, pero quien tenga la
      // PWA instalada de antes (o un marcador viejo) sigue guardando
      // /dashboard hasta que este redirect lo corrija.
      { source: '/dashboard', destination: '/cultivo', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.weatherlink.com",
              // Preview de documentos: iframe apuntando a una signed URL de Supabase Storage
              "frame-src 'self' https://*.supabase.co",
              "font-src 'self'",
              "frame-ancestors 'none'",
              // Service workers necesitan poder registrarse
              "worker-src 'self' blob:",
              "manifest-src 'self'",
            ].join('; '),
          },
        ],
      },
      // Service worker debe servirse con headers específicos
      {
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ]
  },
};

export default withSerwist(nextConfig);
