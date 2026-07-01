import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  // @serwist/next's webpack plugin conflicts with Turbopack, which `next dev`
  // defaults to in Next 16. Only production builds (`next build --webpack`)
  // need the real service worker, so skip Serwist entirely in dev.
  disable: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  // Acknowledges Serwist's webpack config to Turbopack (which `next dev`
  // uses by default in Next 16); Serwist itself is disabled in dev via
  // withSerwistInit's `disable` option above, so this is a no-op in dev.
  turbopack: {},
};

export default withSerwist(nextConfig);
