import type { InstantElementsConfig } from "instant-elements/config";

const config: InstantElementsConfig = {
  elementsDir: "src/elements",
  importAlias: "@/elements",
  registryDir: ".instant/registry",
  pagesDir: ".instant/pages",
  flowsDir: ".instant/flows",
  tokens: { css: "instant-elements/theme.css" },
  gallery: { port: 9221 },
};

export default config;
