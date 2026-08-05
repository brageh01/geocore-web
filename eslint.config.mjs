import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// eslint-config-next 16 already ships flat config, so it is spread directly.
// Wrapping it in FlatCompat (the eslintrc shim) round-trips an already-flat
// config through the legacy validator and throws "Converting circular
// structure to JSON".
const eslintConfig = [
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "public/cesium/**"],
  },
  ...nextCoreWebVitals,
];

export default eslintConfig;
