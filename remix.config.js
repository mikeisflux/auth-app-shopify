/** @type {import('@remix-run/dev').AppConfig} */
const config = {
  ignoredRouteFiles: ["**/.*"],
  serverModuleFormat: "esm",
  serverDependenciesToBundle: [/^@shopify\//],
  future: {
    v3_fetcherPersist: true,
    v3_relativeSplatPath: true,
    v3_throwAbortReason: true,
    v3_singleFetch: true
  }
};

export default config;
