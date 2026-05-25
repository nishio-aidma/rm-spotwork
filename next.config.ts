/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // エラーがあっても無視して公開する
    ignoreBuildErrors: true,
  },
  eslint: {
    // 書き方のチェックも無視する
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;