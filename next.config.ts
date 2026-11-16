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

/** Cabeçalhos de segurança em todas as respostas. Sem CSP aqui: ela precisa ser testada com o Sentry e o service worker. */
const CABECALHOS_SEGURANCA = [
  // O navegador não adivinha o tipo do arquivo: bloqueia script disfarçado de imagem.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Só o próprio site pode colocar as páginas dentro de um frame (evita clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Não vaza o caminho completo para outros sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // O app não usa câmera, microfone, localização nem pagamento do navegador.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
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
