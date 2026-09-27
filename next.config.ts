import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*'],
  // pdf-parse (Slice 4's PDF text extraction) wraps pdfjs-dist, which spawns a worker via a
  // relative file path at runtime — Turbopack/webpack bundling this into a chunk breaks that path
  // ("Setting up fake worker failed", caught live testing the upload path). Keeping it external
  // makes the API route `require()` it directly from node_modules instead, where the relative path
  // resolves correctly — the standard fix for worker-based native packages in Next.js server code.
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
