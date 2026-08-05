import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createFlow, readFlow, writeFlow } from "../flow/store.js";
import { withFileLock } from "./lock.js";
import { emptyPageData, resolveFrame, type PageData } from "./schema.js";
import { isValidSlug, normalizeSlug, slugify } from "./slug.js";
import {
  createPage,
  deletePage,
  listPages,
  pageExists,
  listSnapshots,
  PageConflictError,
  readPage,
  readPageHistory,
  readSnapshot,
  savePage,
} from "./store.js";
import { bumpVersion, compareVersions, migrateVersion } from "./version.js";

const created: string[] = [];

function pagesDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "instant-elements-page-"));
  created.push(dir);
  return dir;
}

const opts = (dir: string) => ({ pagesDir: dir, actor: "tester" });

function dataWith(nodeId: string): PageData {
  return {
    root: { props: { pageSize: "fhd" } },
    content: [{ type: "Stack", props: { id: nodeId, items: [] } }],
    zones: {},
  };
}

afterEach(() => {
  while (created.length > 0) {
    const dir = created.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("슬러그", () => {
  it("한글을 버리지 않는다 — 버리면 한글 제목이 전부 타임스탬프로 떨어진다", () => {
    expect(slugify("대시보드 초안")).toBe("대시보드-초안");
    expect(isValidSlug("대시보드-초안")).toBe(true);
  });

  it("영문·숫자·하이픈을 허용한다", () => {
    expect(slugify("Dashboard V2")).toBe("dashboard-v2");
  });

  it("글자가 하나도 안 남으면 타임스탬프로 폴백한다", () => {
    expect(slugify("2026 / 3", 1234)).toBe("page-1234");
    expect(slugify("!!!", 99)).toBe("page-99");
  });

  it("글자가 하나라도 남으면 유지한다", () => {
    expect(slugify("dashboard 3분기")).toBe("dashboard-3분기");
  });

  it("경로 traversal 을 구조적으로 막는다", () => {
    for (const bad of ["..", "../x", "a/b", "a\\b", "/etc", "a.b"]) {
      expect(isValidSlug(bad), bad).toBe(false);
    }
  });

  it("NFD/NFC 차이를 흡수한다 — macOS 파일명과 브라우저 입력이 다르게 저장된다", () => {
    const nfd = "대시보드".normalize("NFD");
    expect(normalizeSlug(nfd)).toBe("대시보드");
    expect(isValidSlug(nfd)).toBe(true);
  });
});

describe("버전", () => {
  it("patch 가 기본이다", () => {
    expect(bumpVersion("1.0.0")).toBe("1.0.1");
    expect(bumpVersion("1.0.9", "minor")).toBe("1.1.0");
    expect(bumpVersion("1.2.3", "major")).toBe("2.0.0");
  });

  it("레거시 정수 버전을 1.0.(N-1) 로 옮긴다 — '1.0.0 = 최초'를 보존한다", () => {
    expect(migrateVersion(1)).toBe("1.0.0");
    expect(migrateVersion(19)).toBe("1.0.18");
    expect(migrateVersion("19")).toBe("1.0.18");
    expect(migrateVersion("1.2.3")).toBe("1.2.3");
    expect(migrateVersion(undefined)).toBe("1.0.0");
  });

  it("최신순 비교가 숫자로 동작한다 — 문자열 비교면 1.0.10 < 1.0.9 가 된다", () => {
    expect(compareVersions("1.0.10", "1.0.9")).toBeGreaterThan(0);
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
  });
});

describe("페이지 생성", () => {
  it("빈 페이지를 1.0.0 으로 만들고 생성 이력을 남긴다", () => {
    const dir = pagesDir();
    const result = createPage(opts(dir), "대시보드");

    expect(result.slug).toBe("대시보드");
    expect(result.version).toBe("1.0.0");

    const page = readPage(dir, result.slug);
    expect(page.title).toBe("대시보드");
    expect(page.data.content).toEqual([]);

    const history = readPageHistory(dir, result.slug);
    expect(history).toHaveLength(1);
    expect(history[0]?.action).toBe("created");
  });

  it("슬러그가 겹치면 덮어쓰지 않고 번호를 붙인다", () => {
    const dir = pagesDir();
    expect(createPage(opts(dir), "대시보드").slug).toBe("대시보드");
    expect(createPage(opts(dir), "대시보드").slug).toBe("대시보드-2");
    expect(createPage(opts(dir), "대시보드").slug).toBe("대시보드-3");
  });

  it("생성 즉시 스냅샷이 남는다", () => {
    const dir = pagesDir();
    const { slug } = createPage(opts(dir), "x");
    expect(listSnapshots(dir, slug)).toEqual(["1.0.0"]);
  });
});

describe("페이지 삭제", () => {
  /** 흐름 하나 — 이 페이지를 화면으로 쓴다. */
  function flowUsing(dir: string, pageSlug: string): { flowsDir: string; slug: string } {
    const flowsDir = mkdtempSync(join(tmpdir(), "instant-elements-page-flows-"));
    created.push(flowsDir);
    const { slug } = createFlow({ flowsDir, actor: "tester" }, "시연");
    writeFlow({ flowsDir, actor: "tester" }, slug, (flow) => ({
      ...flow,
      start: pageSlug,
      screens: [
        { slug: pageSlug, version: "1.0.0" },
        { slug: "other", version: "1.0.0" },
      ],
      edges: [{ id: "e1", from: { slug: pageSlug, nodeId: "n1" }, to: "other" }],
    }));
    void dir;
    return { flowsDir, slug };
  }

  it("본문·이력·리뷰·스냅샷을 함께 지운다", () => {
    const dir = pagesDir();
    const { slug } = createPage(opts(dir), "지울것");
    writeFileSync(join(dir, `${slug}.feedback.json`), '{"items":[]}');
    expect(listSnapshots(dir, slug)).toEqual(["1.0.0"]);

    expect(deletePage(opts(dir), slug).deleted).toBe(true);

    expect(pageExists(dir, slug)).toBe(false);
    expect(readPageHistory(dir, slug)).toEqual([]);
    expect(listSnapshots(dir, slug)).toEqual([]);
    expect(existsSync(join(dir, `${slug}.feedback.json`))).toBe(false);
  });

  it("이미 없으면 deleted:false — 오류가 아니다", () => {
    const dir = pagesDir();
    // 목록이 조금 옛것이어서 두 번 눌렀을 때 "지웠는데 실패했다"가 뜨면 더 혼란스럽다.
    expect(deletePage(opts(dir), "없는페이지").deleted).toBe(false);
  });

  it("편입한 흐름에서 화면·연결·시작점이 함께 정리된다", () => {
    const dir = pagesDir();
    const { slug } = createPage(opts(dir), "화면");
    const flow = flowUsing(dir, slug);

    const result = deletePage({ ...opts(dir), flowsDir: flow.flowsDir }, slug);

    expect(result.deleted).toBe(true);
    expect(result.detachedFlows).toEqual([flow.slug]);

    const after = readFlow(flow.flowsDir, flow.slug);
    expect(after.screens.map((s) => s.slug)).toEqual(["other"]);
    expect(after.edges).toEqual([]);
    expect(after.start).toBe("other");
  });

  it("flowsDir 를 안 주면 흐름은 손대지 않는다", () => {
    const dir = pagesDir();
    const { slug } = createPage(opts(dir), "화면");
    const flow = flowUsing(dir, slug);

    expect(deletePage(opts(dir), slug).detachedFlows).toEqual([]);
    expect(readFlow(flow.flowsDir, flow.slug).screens).toHaveLength(2);
  });
});

describe("저장과 낙관적 동시성", () => {
  it("--base 가 맞으면 저장되고 버전이 오른다", () => {
    const dir = pagesDir();
    const { slug, version } = createPage(opts(dir), "p");

    const result = savePage(opts(dir), {
      slug,
      base: version,
      data: dataWith("Stack-1"),
      action: "refined",
      note: "초안 조립",
    });

    expect(result.version).toBe("1.0.1");
    expect(readPage(dir, slug).data.content[0]?.props.id).toBe("Stack-1");
  });

  it("그 사이 남이 저장했으면 거부한다 — 조용한 덮어쓰기가 없어야 한다", () => {
    const dir = pagesDir();
    const { slug, version } = createPage(opts(dir), "p");

    savePage(opts(dir), { slug, base: version, data: dataWith("남의-편집") });

    expect(() =>
      savePage(opts(dir), { slug, base: version, data: dataWith("내-편집") }),
    ).toThrow(PageConflictError);

    // 거부됐으니 남의 편집이 그대로 남아 있어야 한다.
    expect(readPage(dir, slug).data.content[0]?.props.id).toBe("남의-편집");
  });

  it("충돌 오류가 현재 버전을 알려준다 — 재적용에 필요하다", () => {
    const dir = pagesDir();
    const { slug, version } = createPage(opts(dir), "p");
    savePage(opts(dir), { slug, base: version, data: emptyPageData() });

    try {
      savePage(opts(dir), { slug, base: version, data: emptyPageData() });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(PageConflictError);
      expect((err as PageConflictError).current).toBe("1.0.1");
      expect((err as PageConflictError).exitCode).toBe(4);
    }
  });

  it("bump 종류를 존중한다", () => {
    const dir = pagesDir();
    const { slug, version } = createPage(opts(dir), "p");
    expect(
      savePage(opts(dir), { slug, base: version, data: emptyPageData(), bump: "minor" }).version,
    ).toBe("1.1.0");
  });

  it("제목을 주지 않으면 기존 제목을 지킨다", () => {
    const dir = pagesDir();
    const { slug, version } = createPage(opts(dir), "원래 제목");
    savePage(opts(dir), { slug, base: version, data: emptyPageData() });
    expect(readPage(dir, slug).title).toBe("원래 제목");
  });

  it("저장마다 이력과 스냅샷이 쌓인다", () => {
    const dir = pagesDir();
    const { slug, version } = createPage(opts(dir), "p");
    const v2 = savePage(opts(dir), { slug, base: version, data: emptyPageData(), note: "1차" });
    savePage(opts(dir), { slug, base: v2.version, data: emptyPageData(), note: "2차" });

    expect(readPageHistory(dir, slug).map((e) => e.note)).toEqual(["2차", "1차", undefined]);
    expect(listSnapshots(dir, slug)).toEqual(["1.0.2", "1.0.1", "1.0.0"]);
  });

  it("스냅샷으로 과거 시점을 읽을 수 있다", () => {
    const dir = pagesDir();
    const { slug, version } = createPage(opts(dir), "p");
    savePage(opts(dir), { slug, base: version, data: dataWith("첫-구조") });

    expect(readSnapshot(dir, slug, "1.0.1")?.data.content[0]?.props.id).toBe("첫-구조");
    expect(readSnapshot(dir, slug, "9.9.9")).toBeNull();
  });
});

describe("읽기 견고성", () => {
  it("없는 페이지와 손상된 페이지를 구분한다 — 손상을 '없음'으로 뭉개면 다음 저장이 날린다", () => {
    const dir = pagesDir();
    expect(() => readPage(dir, "nope")).toThrow(/찾을 수 없습니다/);

    writeFileSync(join(dir, "broken.json"), "{ not json");
    expect(() => readPage(dir, "broken")).toThrow(/손상/);
  });

  it("깨진 페이지 하나가 목록 전체를 죽이지 않는다", () => {
    const dir = pagesDir();
    createPage(opts(dir), "good");
    writeFileSync(join(dir, "bad.json"), "{{{");
    expect(listPages(dir).map((p) => p.slug)).toEqual(["good"]);
  });

  it("피드백 사이드카를 페이지로 오인하지 않는다", () => {
    const dir = pagesDir();
    createPage(opts(dir), "p");
    writeFileSync(join(dir, "p.feedback.json"), '{"items":[]}');
    expect(listPages(dir)).toHaveLength(1);
  });
});

describe("파일 락", () => {
  it("작업이 끝나면 락을 푼다", () => {
    const dir = pagesDir();
    const target = join(dir, "x.json");
    expect(withFileLock(target, () => "결과")).toBe("결과");
    expect(withFileLock(target, () => "다시")).toBe("다시");
  });

  it("예외가 나도 락을 푼다 — 안 그러면 그 파일을 영원히 못 쓴다", () => {
    const dir = pagesDir();
    const target = join(dir, "x.json");
    expect(() =>
      withFileLock(target, () => {
        throw new Error("실패");
      }),
    ).toThrow("실패");
    expect(withFileLock(target, () => "이후에도 잠긴다")).toBe("이후에도 잠긴다");
  });
});

describe("프레임", () => {
  it("페이지가 지정한 크기를 쓴다", () => {
    expect(resolveFrame("qhd").width).toBe(2560);
  });

  it("흐름의 지정이 페이지를 이긴다 — 시연 중 캔버스가 리사이즈되면 못 쓴다", () => {
    expect(resolveFrame("qhd", "fhd").width).toBe(1920);
  });

  it("모르는 값이면 기본 프레임으로 떨어진다", () => {
    expect(resolveFrame(undefined).id).toBe("fhd");
    expect(resolveFrame("있지도-않은-크기").id).toBe("fhd");
  });
});
