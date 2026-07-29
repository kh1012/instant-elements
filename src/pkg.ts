import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/** 번들된 dist/*.js 기준 한 단계 위 = 패키지 루트. `files` 와 무관하게 npm 은 항상 package.json 을 싣는다. */
export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const manifest = require("../package.json") as { name: string; version: string };

export const packageName = manifest.name;
export const packageVersion = manifest.version;
