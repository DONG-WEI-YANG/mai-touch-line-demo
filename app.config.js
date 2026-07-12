// Dynamic Expo config layered on top of app.json.
//
// Sole purpose: inject `experiments.baseUrl` from the EXPO_BASE_URL env var at
// export time, so the GitHub Pages build can serve under a repo sub-path
// (/mai-touch-line-demo/) while local dev and any root-hosted build stay at "/".
// Expo reads app.json first and passes it here as `config`; we spread it and only
// override baseUrl when the env var is set.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...(config.experiments ?? {}),
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
