import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfig } from "../config/resolve.js";
import type { ResolvedConfig } from "../config/types.js";
import { LIB_DIR_NAME } from "./create.js";
import { readEntry } from "./entry.js";
import { readHistory } from "./history.js";
import { installBundle, validateBundle } from "./install.js";
import type { PublishBundle } from "./publish.js";

const created: string[] = [];

async function project(): Promise<ResolvedConfig> {
  const root = mkdtempSync(join(tmpdir(), "instant-elements-install-"));
  created.push(root);
  writeFileSync(join(root, "package.json"), '{"name":"demo"}');
  return resolveConfig({ cwd: root });
}

/** 발행자의 디렉토리 구조는 설치자와 다를 수 있다 — 일부러 다른 경로로 만든다. */
function bundle(overrides: Partial<PublishBundle> = {}): PublishBundle {
  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: "stat-card",
    type: "registry:component",
    description: "숫자 하나를 보여주는 카드",
    files: [
      {
        path: "packages/ui/widgets/stat-card/stat-card.tsx",
        type: "registry:component",
        content: 'import { cn } from "../_lib/cn";\nexport function StatCard() { return null; }\n',
      },
      {
        path: "packages/ui/widgets/stat-card/stat-card.demo.tsx",
        type: "registry:file",
        content: "export default function StatCardDemo() { return null; }\n",
      },
      {
        path: "packages/ui/widgets/stat-card/index.ts",
        type: "registry:file",
        content: 'export * from "./stat-card";\n',
      },
      {
        path: `packages/ui/widgets/${LIB_DIR_NAME}/cn.ts`,
        type: "registry:file",
        content: "export function cn() { return ''; }\n",
      },
    ],
    meta: {
      status: "stable",
      category: "Composite",
      intent: "대시보드 지표 카드",
      summary: "숫자 하나를 보여주는 카드",
      keywords: ["지표"],
      createdBy: "publisher",
      createdAt: "2026-07-01T00:00:00.000Z",
      demo: "packages/ui/widgets/stat-card/stat-card.demo.tsx",
      exportName: "StatCard",
    },
    ...overrides,
  };
}

const opts = { source: "https://example.com/stat-card.json", actor: "installer" };

afterEach(() => {
  while (created.length > 0) {
    const dir = created.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("installBundle", () => {
  it("발행자 경로가 아니라 **내** 디렉토리 구조로 다시 심는다", async () => {
    const config = await project();
    installBundle(config, bundle(), opts);

    const dir = join(config.elementsDir, "stat-card");
    expect(existsSync(join(dir, "stat-card.tsx"))).toBe(true);
    expect(existsSync(join(dir, "stat-card.demo.tsx"))).toBe(true);
    expect(existsSync(join(dir, "index.ts"))).toBe(true);
    expect(existsSync(join(config.elementsDir, LIB_DIR_NAME, "cn.ts"))).toBe(true);
    // 발행자 경로는 어디에도 만들어지지 않는다.
    expect(existsSync(join(config.root, "packages"))).toBe(false);
  });

  it("엔트리를 만들어 갤러리·재사용 검색에 걸리게 한다", async () => {
    const config = await project();
    const result = installBundle(config, bundle(), opts);

    const entry = readEntry(config, "stat-card");
    expect(entry.files[0]?.path).toBe("src/elements/stat-card/stat-card.tsx");
    expect(entry.meta.demo).toBe("src/elements/stat-card/stat-card.demo.tsx");
    expect(result.indexCount).toBe(1);
  });

  it("만든이·만든 때는 설치자 기준 — 다른 명령과 같은 뜻이어야 한다", async () => {
    const config = await project();
    installBundle(config, bundle(), opts);

    const meta = readEntry(config, "stat-card").meta;
    expect(meta.createdBy).toBe("installer");
    // 발행일(2026-07-01)이 아니라 방금이어야 "새로 생김" 필터가 방금 받아온 걸 찾는다.
    expect(Date.now() - Date.parse(meta.createdAt)).toBeLessThan(10_000);
  });

  it("크레딧은 origin 에 온전히 남는다", async () => {
    const config = await project();
    installBundle(config, bundle(), opts);

    expect(readEntry(config, "stat-card").meta.origin).toEqual({
      source: "https://example.com/stat-card.json",
      publishedBy: "publisher",
      publishedAt: "2026-07-01T00:00:00.000Z",
    });
  });

  it("직접 만든 컴포넌트에는 origin 이 없다 — 있고 없음이 곧 출처의 유무다", async () => {
    const config = await project();
    const { createElement } = await import("./create.js");
    const { entry } = createElement(config, {
      name: "mine",
      intent: "직접 만든 것",
      summary: "직접 만든 것",
      createdBy: "me",
    });
    expect(entry.meta.origin).toBeUndefined();
  });

  it("설치 사실을 발행자와 함께 히스토리에 남긴다", async () => {
    const config = await project();
    installBundle(config, bundle(), opts);

    const history = readHistory(config, "stat-card");
    expect(history[0]?.actor).toBe("installer");
    expect(history[0]?.note).toContain("@publisher");
    expect(history[0]?.note).toContain("https://example.com/stat-card.json");
  });

  it("이미 있는 공유 cn 헬퍼는 덮지 않는다 — 프로젝트 전체가 흔들린다", async () => {
    const config = await project();
    const cnPath = join(config.elementsDir, LIB_DIR_NAME, "cn.ts");
    mkdirSync(join(config.elementsDir, LIB_DIR_NAME), { recursive: true });
    writeFileSync(cnPath, "// 내가 고쳐 둔 것\n");

    const result = installBundle(config, bundle(), opts);

    expect(readFileSync(cnPath, "utf8")).toBe("// 내가 고쳐 둔 것\n");
    expect(result.skipped.some((f) => f.endsWith("cn.ts"))).toBe(true);
  });

  it("같은 이름이 이미 있으면 막는다", async () => {
    const config = await project();
    installBundle(config, bundle(), opts);
    expect(() => installBundle(config, bundle(), opts)).toThrow(/이미 등록된/);
    expect(() => installBundle(config, bundle(), { ...opts, force: true })).not.toThrow();
  });

  it("본체가 없는 번들은 거부한다", async () => {
    const config = await project();
    const broken = bundle({
      files: [
        {
          path: "x/stat-card/stat-card.demo.tsx",
          type: "registry:file",
          content: "export default function D() { return null; }\n",
        },
      ],
    });
    expect(() => installBundle(config, broken, opts)).toThrow(/본체가 없습니다/);
  });
});

describe("경로 탈출 방어", () => {
  it("번들이 프로젝트 밖을 가리켜도 그 경로로 쓰지 않는다", async () => {
    const config = await project();
    const malicious = bundle({
      files: [
        // 정상 본체 — 설치 자체는 성공해야 한다.
        {
          path: "x/stat-card/stat-card.tsx",
          type: "registry:component",
          content: "export function StatCard() { return null; }\n",
        },
        // 탈출을 노리는 파일. 분류되지 않으므로 버려진다.
        {
          path: "../../../../../../tmp/ie-pwned.txt",
          type: "registry:file",
          content: "pwned\n",
        },
      ],
    });

    installBundle(config, malicious, opts);

    expect(existsSync("/tmp/ie-pwned.txt")).toBe(false);
    // 본체는 정상적으로 내 경로에 심긴다.
    expect(existsSync(join(config.elementsDir, "stat-card", "stat-card.tsx"))).toBe(true);
  });

  it("이름 자체에 경로 조각이 들어오면 검증에서 걸린다", () => {
    expect(() => validateBundle(bundle({ name: "../escape" }))).toThrow();
    expect(() => validateBundle(bundle({ name: "Stat Card" }))).toThrow();
  });
});

describe("validateBundle", () => {
  it("정상 번들은 통과한다", () => {
    expect(() => validateBundle(bundle())).not.toThrow();
  });

  it("모양이 안 맞으면 쓰기 전에 막는다", () => {
    expect(() => validateBundle(null)).toThrow(/객체가 아닙니다/);
    expect(() => validateBundle(bundle({ files: [] }))).toThrow(/files 가 비었습니다/);
    expect(() => validateBundle({ ...bundle(), meta: { ...bundle().meta, category: "Nope" } })).toThrow(
      /category/,
    );
  });
});
