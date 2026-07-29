import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appendHistory, readHistory } from "./history.js";
import { buildIndex, writeIndex } from "./index-file.js";
import { listEntryNames, readEntry, tryReadEntry, validateEntry, writeEntry } from "./entry.js";
import { readJsonClassified, writeJsonAtomic } from "./io.js";
import { assertValidName, elementPaths, isValidName, pascalCase } from "./paths.js";
import { ENTRY_SCHEMA_URL, type Entry } from "./schema.js";

const created: string[] = [];

interface Harness {
  root: string;
  elementsDir: string;
  entriesDir: string;
  indexFile: string;
}

function harness(): Harness {
  const root = mkdtempSync(join(tmpdir(), "instant-elements-reg-"));
  created.push(root);
  const elementsDir = join(root, "src/elements");
  const entriesDir = join(root, ".instant/registry/entries");
  mkdirSync(elementsDir, { recursive: true });
  mkdirSync(entriesDir, { recursive: true });
  return { root, elementsDir, entriesDir, indexFile: join(root, ".instant/registry/index.json") };
}

function makeEntry(name: string, overrides: Partial<Entry["meta"]> = {}): Entry {
  return {
    $schema: ENTRY_SCHEMA_URL,
    name,
    type: "registry:component",
    description: `${name} 설명`,
    files: [{ path: `src/elements/${name}/${name}.tsx`, type: "registry:component" }],
    meta: {
      status: "draft",
      category: "Composite",
      intent: `${name} 를 만들어줘`,
      summary: `${name} 입니다.`,
      keywords: [name, "테스트"],
      createdBy: "tester",
      createdAt: "2026-07-29T12:00:00.000Z",
      ...overrides,
    },
  };
}

afterEach(() => {
  while (created.length > 0) {
    const dir = created.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("이름 규칙", () => {
  it("kebab-case 만 허용한다", () => {
    for (const ok of ["a", "card", "stat-card", "gnb-2", "a1-b2-c3"]) {
      expect(isValidName(ok), ok).toBe(true);
    }
    for (const bad of ["", "-card", "card-", "Card", "stat_card", "stat card", "a".repeat(65)]) {
      expect(isValidName(bad), bad).toBe(false);
    }
  });

  it("경로 traversal 을 구조적으로 막는다", () => {
    for (const attack of ["..", "../etc", "a/../b", "./x", "a\\b", "/etc/passwd"]) {
      expect(() => assertValidName(attack), attack).toThrow();
    }
  });

  it("PascalCase 로 변환한다", () => {
    expect(pascalCase("stat-card")).toBe("StatCard");
    expect(pascalCase("gnb")).toBe("Gnb");
    expect(pascalCase("a-b-c")).toBe("ABC");
  });

  it("경로가 지정한 디렉토리 안에 봉쇄된다", () => {
    const h = harness();
    const paths = elementPaths(h, "stat-card");
    expect(paths.dir).toBe(join(h.elementsDir, "stat-card"));
    expect(paths.component).toBe(join(h.elementsDir, "stat-card", "stat-card.tsx"));
    expect(paths.entry).toBe(join(h.entriesDir, "stat-card.json"));
    expect(paths.history).toBe(join(h.entriesDir, "stat-card.history.jsonl"));
  });
});

describe("엔트리 읽기·쓰기", () => {
  it("쓴 그대로 읽힌다", () => {
    const h = harness();
    const entry = makeEntry("stat-card");
    writeEntry(h, entry);
    expect(readEntry(h, "stat-card")).toEqual(entry);
  });

  it("없는 엔트리는 명확한 오류를 던진다", () => {
    const h = harness();
    expect(() => readEntry(h, "nope")).toThrow(/찾을 수 없습니다/);
  });

  it("손상된 JSON 을 '없음'으로 뭉개지 않는다", () => {
    const h = harness();
    writeFileSync(join(h.entriesDir, "broken.json"), "{ not json");
    expect(() => readEntry(h, "broken")).toThrow(/손상/);
  });

  it("파일명과 name 이 어긋나면 거부한다", () => {
    const h = harness();
    writeJsonAtomic(join(h.entriesDir, "a.json"), makeEntry("b"));
    expect(() => readEntry(h, "a")).toThrow(/name 이 파일명과 다릅니다/);
  });

  it("목록은 사전순이고 history.jsonl 을 섞지 않는다", () => {
    const h = harness();
    for (const name of ["zeta", "alpha", "mid"]) writeEntry(h, makeEntry(name));
    appendHistory(h, "alpha", {
      at: "2026-07-29T12:00:00.000Z",
      actor: "t",
      action: "created",
    });
    expect(listEntryNames(h)).toEqual(["alpha", "mid", "zeta"]);
  });

  it("엔트리 디렉토리가 없어도 빈 목록을 준다", () => {
    const h = harness();
    rmSync(h.entriesDir, { recursive: true, force: true });
    expect(listEntryNames(h)).toEqual([]);
  });

  it("깨진 엔트리 하나가 목록 전체를 죽이지 않는다", () => {
    const h = harness();
    writeEntry(h, makeEntry("good"));
    writeFileSync(join(h.entriesDir, "bad.json"), "{{{");
    expect(tryReadEntry(h, "bad")).toBeNull();
    expect(buildIndex({ ...h, root: h.root }).components.map((c) => c.name)).toEqual(["good"]);
  });
});

describe("엔트리 검증", () => {
  it("올바른 엔트리는 문제 없음", () => {
    expect(validateEntry(makeEntry("ok"))).toEqual([]);
  });

  it("필수 필드 누락을 지적한다", () => {
    const entry = makeEntry("x");
    entry.meta.summary = "";
    entry.meta.keywords = [];
    const problems = validateEntry(entry);
    expect(problems.some((p) => p.includes("summary"))).toBe(true);
    expect(problems.some((p) => p.includes("keywords"))).toBe(true);
  });

  it("잘못된 status·category 를 지적한다", () => {
    const entry = makeEntry("x");
    (entry.meta as { status: string }).status = "promoted";
    (entry.meta as { category: string }).category = "Widget";
    const problems = validateEntry(entry);
    expect(problems.some((p) => p.includes("status"))).toBe(true);
    expect(problems.some((p) => p.includes("category"))).toBe(true);
  });
});

describe("index.json 결정성", () => {
  it("같은 엔트리면 출력이 바이트 단위로 같다", () => {
    const h = harness();
    for (const name of ["b-two", "a-one", "c-three"]) writeEntry(h, makeEntry(name));

    writeIndex({ ...h, root: h.root });
    const first = readFileSync(h.indexFile, "utf8");
    writeIndex({ ...h, root: h.root });
    const second = readFileSync(h.indexFile, "utf8");

    expect(second).toBe(first);
  });

  it("타임스탬프를 넣지 않는다 — 재생성만으로 diff 가 나면 안 된다", () => {
    const h = harness();
    writeEntry(h, makeEntry("only"));
    const index = buildIndex({ ...h, root: h.root });
    expect(JSON.stringify(index)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("이름순으로 정렬한다", () => {
    const h = harness();
    for (const name of ["zulu", "alpha", "mike"]) writeEntry(h, makeEntry(name));
    expect(buildIndex({ ...h, root: h.root }).components.map((c) => c.name)).toEqual([
      "alpha",
      "mike",
      "zulu",
    ]);
  });

  it("데모 파일 유무를 hasDemo 로 알린다", () => {
    const h = harness();
    writeEntry(h, makeEntry("with-demo"));
    writeEntry(h, makeEntry("no-demo"));
    mkdirSync(join(h.elementsDir, "with-demo"), { recursive: true });
    writeFileSync(join(h.elementsDir, "with-demo", "with-demo.demo.tsx"), "export default null;");

    const byName = Object.fromEntries(
      buildIndex({ ...h, root: h.root }).components.map((c) => [c.name, c.hasDemo]),
    );
    expect(byName["with-demo"]).toBe(true);
    expect(byName["no-demo"]).toBe(false);
  });

  it("count 가 실제 개수와 일치한다", () => {
    const h = harness();
    for (const name of ["a", "b", "c"]) writeEntry(h, makeEntry(name));
    const index = buildIndex({ ...h, root: h.root });
    expect(index.count).toBe(3);
    expect(index.components).toHaveLength(3);
  });
});

describe("히스토리", () => {
  it("append 한 이벤트를 최신순으로 돌려준다", () => {
    const h = harness();
    appendHistory(h, "card", {
      at: "2026-07-29T10:00:00.000Z",
      actor: "kh",
      action: "created",
      prompt: "카드 만들어줘",
    });
    appendHistory(h, "card", {
      at: "2026-07-29T11:00:00.000Z",
      actor: "kh",
      action: "modified",
      note: "여백 조정",
      sha: "abc123",
    });

    const events = readHistory(h, "card");
    expect(events.map((e) => e.action)).toEqual(["modified", "created"]);
    expect(events[0]?.sha).toBe("abc123");
    expect(events[1]?.prompt).toBe("카드 만들어줘");
  });

  it("타임스탬프가 같아도 append 순서(인과)가 보존된다", () => {
    const h = harness();
    const at = "2026-07-29T10:00:00.000Z";
    appendHistory(h, "card", { at, actor: "kh", action: "created", note: "첫째" });
    appendHistory(h, "card", { at, actor: "kh", action: "modified", note: "둘째" });
    expect(readHistory(h, "card").map((e) => e.note)).toEqual(["둘째", "첫째"]);
  });

  it("개행·코드펜스가 든 원문 프롬프트를 그대로 보존한다", () => {
    const h = harness();
    const prompt = '여기 참고해줘\n\n```tsx\n<Card title="a" />\n```\n\nhttps://example.com/x?a=1&b=2';
    appendHistory(h, "card", { at: "2026-07-29T10:00:00.000Z", actor: "kh", action: "created", prompt });
    expect(readHistory(h, "card")[0]?.prompt).toBe(prompt);
  });

  it("깨진 줄 하나가 전체 이력을 못 읽게 만들지 않는다", () => {
    const h = harness();
    const path = elementPaths(h, "card").history;
    appendHistory(h, "card", { at: "2026-07-29T10:00:00.000Z", actor: "kh", action: "created" });
    writeFileSync(path, `${readFileSync(path, "utf8")}{ 깨진 줄\n`);
    appendHistory(h, "card", { at: "2026-07-29T12:00:00.000Z", actor: "kh", action: "modified" });

    expect(readHistory(h, "card").map((e) => e.action)).toEqual(["modified", "created"]);
  });

  it("알 수 없는 action 은 걸러낸다", () => {
    const h = harness();
    const path = elementPaths(h, "card").history;
    writeFileSync(
      path,
      `${JSON.stringify({ at: "x", actor: "y", action: "promoted" })}\n${JSON.stringify({
        at: "2026-07-29T10:00:00.000Z",
        actor: "kh",
        action: "created",
      })}\n`,
    );
    expect(readHistory(h, "card").map((e) => e.action)).toEqual(["created"]);
  });

  it("이력이 없으면 빈 배열", () => {
    expect(readHistory(harness(), "nothing")).toEqual([]);
  });
});

describe("원자적 쓰기", () => {
  it("tmp 파일을 남기지 않는다", () => {
    const h = harness();
    writeEntry(h, makeEntry("card"));
    const leftovers = listEntryNames(h).filter((n) => n.includes("tmp"));
    expect(leftovers).toEqual([]);
  });

  it("없는 파일은 missing, 깨진 파일은 corrupt 로 구분한다", () => {
    const h = harness();
    expect(readJsonClassified(join(h.root, "nope.json")).status).toBe("missing");
    const broken = join(h.root, "broken.json");
    writeFileSync(broken, "{");
    expect(readJsonClassified(broken).status).toBe("corrupt");
  });

  it("상위 디렉토리가 없어도 만들어 쓴다", () => {
    const h = harness();
    const deep = join(h.root, "a/b/c/file.json");
    writeJsonAtomic(deep, { ok: true });
    expect(JSON.parse(readFileSync(deep, "utf8"))).toEqual({ ok: true });
  });
});
