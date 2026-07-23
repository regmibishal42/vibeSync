import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every route reads per-user/RLS-scoped data, so no `'use cache'` is used
  // anywhere in this app — the value here is Partial Prerendering (every
  // dynamic access is now wrapped in <Suspense>, see src/app/(app)/**),
  // React's <Activity>-based state preservation across client-side nav, and
  // /login prerendering fully static (see unstable_instant below).
  cacheComponents: true,
  experimental: {
    // Dev-only DevTools panel for inspecting the static-shell/streaming
    // boundaries built during the Suspense refactor.
    instantNavigationDevToolsToggle: true,
    // Inlines critical CSS instead of a <link>, improving first paint for an
    // atomic-CSS (Tailwind) app; PPR/cacheComponents routes still fall back
    // to <link> tags on client navigation, so there's no cross-page-caching
    // downside once Phase 4 (cacheComponents) lands.
    inlineCss: true,
    // React's native <ViewTransition>, integrated with the router — replaces
    // framer-motion's would-be role for page/element transitions at zero
    // added bundle cost (framer-motion was removed as unused, see Phase 0).
    viewTransition: true,
  },
  // Requires the babel-plugin-react-compiler devDependency (added in
  // Phase 0). Next applies it via a custom SWC pass only to relevant files,
  // so it doesn't slow down the whole build the way the plain Babel plugin
  // would.
  reactCompiler: true,
};

export default nextConfig;
