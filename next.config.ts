import type { NextConfig } from "next";
import CopyWebpackPlugin from "copy-webpack-plugin";
import path from "path";

const cesiumSource = path.join(
  process.cwd(),
  "node_modules",
  "cesium",
  "Build",
  "Cesium"
);

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            {
              from: path.join(cesiumSource, "Workers"),
              to: path.join(process.cwd(), "public", "cesium", "Workers"),
            },
            {
              from: path.join(cesiumSource, "ThirdParty"),
              to: path.join(process.cwd(), "public", "cesium", "ThirdParty"),
            },
            {
              from: path.join(cesiumSource, "Assets"),
              to: path.join(process.cwd(), "public", "cesium", "Assets"),
            },
            {
              from: path.join(cesiumSource, "Widgets"),
              to: path.join(process.cwd(), "public", "cesium", "Widgets"),
            },
          ],
        })
      );

      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        http: false,
        https: false,
        zlib: false,
      };
    }

    return config;
  },
};

export default nextConfig;
