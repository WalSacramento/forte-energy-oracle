const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  optimizeFonts: false,
  transpilePackages: ["geist"],
};

module.exports = withNextIntl(nextConfig);
