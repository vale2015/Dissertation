/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  // Allows a clean verification build when OneDrive locks the normal .next output.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
