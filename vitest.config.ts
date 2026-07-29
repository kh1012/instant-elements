import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // 갤러리는 런타임에 Vite 가 해석하지만, 테스트에서는 계약 소스로 직접 연결한다.
      "instant-elements/registry": `${root}src/registry/schema.ts`,
      "instant-elements/page": `${root}src/page/schema.ts`,
    },
  },
  test: {
    include: ["src/**/*.test.ts", "gallery/src/**/*.test.ts"],
    environment: "node",
  },
});
