import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Unique per build so the precached /offline document is re-fetched on each
// deploy (see manifestTransforms below).
const OFFLINE_REVISION = Date.now().toString(36);

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  // @serwist/next's webpack plugin conflicts with Turbopack, which `next dev`
  // defaults to in Next 16. Only production builds (`next build --webpack`)
  // need the real service worker, so skip Serwist entirely in dev.
  disable: process.env.NODE_ENV !== "production",
  // @serwist/next only precaches webpack client assets + public/ files, never
  // rendered HTML. The /offline document fallback (referenced in src/sw.ts) must
  // itself be precached for the fallback to resolve, so inject it here. A
  // per-build revision refreshes it on every deploy, keeping it in step with the
  // hashed chunks it references (a fixed revision would serve stale HTML).
  manifestTransforms: [
    (entries) => ({
      manifest: [
        ...entries,
        { url: "/offline", revision: OFFLINE_REVISION, size: 0 },
      ],
    }),
  ],
});

const nextConfig: NextConfig = {
  // Acknowledges Serwist's webpack config to Turbopack (which `next dev`
  // uses by default in Next 16); Serwist itself is disabled in dev via
  // withSerwistInit's `disable` option above, so this is a no-op in dev.
  turbopack: {},
};

export default withSerwist(nextConfig);
