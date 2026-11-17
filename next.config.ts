import type { NextConfig } from "next";
import { spawnSync } from "node:child_process";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs/config";

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: false,
  cacheOnNavigation: true,
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  exclude: [/pdf\.worker/, /videos\//],
});

/**
 * CSP alinhada ao que o site realmente carrega: Next/Serwist, Google Identity Services e Sentry.
 * 'unsafe-inline' / 'unsafe-eval' ainda entram porque o App Router e o SW dependem disso hoje;
 * apertar com nonce fica para uma rodada dedicada.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io https://accounts.google.com https://www.googleapis.com https://oauth2.googleapis.com",
  "frame-src https://accounts.google.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

/** Cabeçalhos de segurança em todas as respostas. */
const CABECALHOS_SEGURANCA = [
  // O navegador não adivinha o tipo do arquivo: bloqueia script disfarçado de imagem.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Só o próprio site pode colocar as páginas dentro de um frame (evita clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Não vaza o caminho completo para outros sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // O app não usa câmera, microfone, localização nem pagamento do navegador.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // HTTPS obrigatório por 2 anos (só tem efeito em produção, atrás de TLS).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  // Permite acesso ao dev server via IP de rede (ex.: Tailscale)
  allowedDevOrigins: ["100.77.211.95"],
  async headers() {
    return [{ source: "/:path*", headers: CABECALHOS_SEGURANCA }];
  },
};

export default withSentryConfig(withSerwist(nextConfig), {
  org: "italo-f",
  project: "javascript-nextjs",
  silent: true,
  // Sem source maps upload -- evita depender de SENTRY_AUTH_TOKEN no build da Vercel.
  sourcemaps: { disable: true },
});
