import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Webpack turns the vendored TailAdmin icons into components via @svgr;
// vitest gets a stub component so chrome that imports @/icons renders.
const svgStub: Plugin = {
  name: "svg-stub",
  enforce: "pre",
  load(id) {
    if (id.endsWith(".svg")) {
      return `import * as React from "react";
export default function SvgStub(props) { return React.createElement("svg", props); }`;
    }
  },
};

export default defineConfig({
  plugins: [svgStub, react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
