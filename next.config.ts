import type { NextConfig } from "next";
import { spawnSync } from "node:child_process";
import withSerwistInit from "@serwist/next";

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

export default withSerwist(nextConfig);
