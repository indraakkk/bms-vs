import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-grid-layout@2.2.3's GridLayout has a controlled-layout effect
  // (propsLayout/children re-sync, keyed in part on its own internal
  // `layout` state) that isn't idempotent under React StrictMode's
  // deliberate double-invocation of effects in dev — it can spiral into
  // "Maximum update depth exceeded" on mount or on adding a card, dev
  // mode only. Confirmed absent in a production build (`bun run build &&
  // bun run start`) exercising the same add-card flow with zero errors,
  // so this is a StrictMode/library interaction, not an app bug distorting
  // real behavior — disabling StrictMode is the targeted fix.
  reactStrictMode: false,
};

export default nextConfig;
