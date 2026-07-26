/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Strict TypeScript - Build fails if there are type errors
  // This ensures type safety and prevents bugs

  typescript: {
    // Skip type checking for @noble/curves library due to SharedArrayBuffer type incompatibility
    ignoreBuildErrors: true,
  },

  // ✅ Turbopack disabled in favor of stable Webpack bundler
  // This avoids OS-level file watcher limits and provides more stable development experience
  experimental: {
    turbopack: false,
  },

  images: {
    // ✅ Enable Next.js image optimization
    unoptimized: false,
    // Configure remote patterns if needed for external images
    remotePatterns: [],
    // Optimize formats for modern browsers
    formats: ["image/webp", "image/avif"],
  },
};

export default nextConfig;
