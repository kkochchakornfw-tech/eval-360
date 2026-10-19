/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // lets a build be verified without touching a running dev server's .next folder
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
export default nextConfig;
