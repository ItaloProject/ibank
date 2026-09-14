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

const nextConfig: NextConfig = {
  // Permite acesso ao dev server via IP de rede (ex.: Tailscale)
  allowedDevOrigins: ["100.77.211.95"],
};

export default withSentryConfig(withSerwist(nextConfig), {
  org: "italo-f",
  project: "javascript-nextjs",
  silent: true,
  // Sem source maps upload -- evita depender de SENTRY_AUTH_TOKEN no build da Vercel.
  sourcemaps: { disable: true },
});
