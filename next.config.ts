import type { NextConfig } from "next";
// import type { Configuration } from 'webpack'; // Remove webpack type import

const nextConfig: NextConfig = {
  /* config options here */
  // Remove the webpack configuration section
  // webpack: (config: Configuration, { isServer }) => {
  //   // Provide a fallback for the 'encoding' module for client-side bundles
  //   if (!isServer) {
  //     config.resolve ??= {}; // Ensure resolve object exists
  //     config.resolve.fallback ??= {}; // Ensure fallback object exists
  //     config.resolve.fallback.encoding = false;
  //   }
  //
  //   // Important: return the modified config
  //   return config;
  // },
};

export default nextConfig;
