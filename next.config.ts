import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite acesso ao dev server via IP de rede (ex.: Tailscale)
  allowedDevOrigins: ["100.77.211.95"],
};

export default nextConfig;
