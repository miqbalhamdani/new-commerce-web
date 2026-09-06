import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "contracts/**",
      // Generated from contracts/openapi.yaml -- see npm run generate.
      "src/lib/api/schema.d.ts",
    ],
  },
  ...coreWebVitals,
  ...typescript,
];

export default config;
