import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep `ws` a real runtime require instead of a webpack bundle: bundling it
  // stubs its optional native peers (bufferutil/utf-8-validate) to an empty
  // no-op module rather than letting them fail a real `require()` and fall
  // back to ws's pure-JS masking, which is what threw "b.unmask is not a
  // function" from the socket route.
  serverExternalPackages: ["ws", "bufferutil", "utf-8-validate"],
};

export default nextConfig;
