import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    config: "src/config.ts",
    // shebang 은 src/cli.ts 첫 줄에 있고 tsup 이 그대로 보존한다.
    cli: "src/cli.ts",
  },
  format: ["esm"],
  target: "node20",
  platform: "node",
  dts: true,
  clean: true,
  sourcemap: true,
  esbuildOptions(options) {
    options.charset = "utf8";
  },
});
