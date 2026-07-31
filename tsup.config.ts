import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    config: "src/config.ts",
    tokens: "src/tokens.ts",
    registry: "src/registry/index.ts",
    page: "src/page/schema.ts",
    // 계약만 내보낸다 — run-store 는 node:child_process 를 끌어오므로 진입점이 될 수 없다.
    agent: "src/agent/types.ts",
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
