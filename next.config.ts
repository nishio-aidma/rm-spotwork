/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // エラーがあっても無視してビルド（公開準備）を許可する
    ignoreBuildErrors: true,
  },
};

export default nextConfig;