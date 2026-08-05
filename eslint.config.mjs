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
  {
    // Client-side code must never reach into server/. Those modules are
    // `server-only` and hold upstream API keys and provider logic; importing
    // one from the browser bundle either fails the build or, worse, leaks a
    // secret. Data crosses the boundary over app/api/** and is typed by
    // lib/contracts.ts — import from there instead.
    files: ["components/**", "hooks/**", "store/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server", "@/server/**", "**/server", "**/server/**"],
              message:
                "Client code (components/, hooks/, store/) must not import from server/. Those modules are server-only and carry API keys. Fetch from an app/api/** route and use the types in @/lib/contracts instead.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
