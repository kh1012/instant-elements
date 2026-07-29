import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AGENT_DIRS, isSkillName, readGuide, shippedSkillDir, SKILL_NAMES } from "./index.js";

const created: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "instant-elements-skill-"));
  created.push(root);
  return root;
}

afterEach(() => {
  while (created.length > 0) {
    const dir = created.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("배포되는 스킬", () => {
  it("스텁과 정본이 모두 패키지에 실려 있다", () => {
    for (const name of SKILL_NAMES) {
      expect(existsSync(join(shippedSkillDir(name), "SKILL.md")), `${name} SKILL.md`).toBe(true);
      expect(existsSync(join(shippedSkillDir(name), "GUIDE.md")), `${name} GUIDE.md`).toBe(true);
    }
  });

  it("스텁 프론트매터의 name 이 디렉토리 이름과 같다 — 어긋나면 에이전트가 못 찾는다", () => {
    for (const name of SKILL_NAMES) {
      const stub = readFileSync(join(shippedSkillDir(name), "SKILL.md"), "utf8");
      expect(stub).toMatch(new RegExp(`^---[\\s\\S]*?\\nname:\\s*${name}\\s*\\n`));
    }
  });

  it("스텁이 절차를 복사해 두지 않고 정본으로 라우팅한다 — 복사본은 반드시 낡는다", () => {
    for (const name of SKILL_NAMES) {
      const stub = readFileSync(join(shippedSkillDir(name), "SKILL.md"), "utf8");
      expect(stub).toContain(`ie guide ${name}`);
      // 스텁이 길어지면 그 자체가 두 번째 정본이 된다.
      expect(stub.split("\n").length).toBeLessThan(45);
    }
  });

  it("정본이 경로를 하드코딩하지 않고 설정에서 읽으라고 지시한다", () => {
    const guide = readFileSync(join(shippedSkillDir("element-create"), "GUIDE.md"), "utf8");
    expect(guide).toContain("ie config --json");
    expect(guide).toContain("경로를 하드코딩하지 않는다");
  });

  it("정본에 딥링크 검증 게이트가 있다 — SPA 는 없는 이름에도 200 을 준다", () => {
    const guide = readFileSync(join(shippedSkillDir("element-create"), "GUIDE.md"), "utf8");
    expect(guide).toContain("/api/entry/");
    expect(guide).toContain("미검증");
  });

  it("정본이 재사용 추천도 기록하라고 지시한다 — 없으면 재사용률을 잴 수 없다", () => {
    const guide = readFileSync(join(shippedSkillDir("element-create"), "GUIDE.md"), "utf8");
    expect(guide).toContain("--action recommended");
  });

  it("isSkillName 이 목록 밖 이름을 거부한다", () => {
    expect(isSkillName("element-create")).toBe(true);
    expect(isSkillName("component-apply")).toBe(false);
    expect(isSkillName("../etc/passwd")).toBe(false);
  });
});

describe("GUIDE 해석", () => {
  it("프로젝트 override 가 없으면 패키지 정본을 쓴다", () => {
    const guide = readGuide("element-create", tempRoot());
    expect(guide?.path).toBe(join(shippedSkillDir("element-create"), "GUIDE.md"));
  });

  it("프로젝트에 .instant/skills/<name>/GUIDE.md 가 있으면 그쪽이 이긴다", () => {
    const root = tempRoot();
    const dir = join(root, ".instant", "skills", "element-create");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "GUIDE.md"), "# 우리 팀 규칙\n");

    const guide = readGuide("element-create", root);
    expect(guide?.path).toBe(join(dir, "GUIDE.md"));
    expect(guide?.body).toContain("우리 팀 규칙");
  });
});

describe("에이전트 설치 위치", () => {
  it("Claude Code 와 Codex 가 각자 탐색하는 디렉토리를 안다", () => {
    expect(AGENT_DIRS["claude"]).toBe(".claude/skills");
    expect(AGENT_DIRS["codex"]).toBe(".agents/skills");
  });
});
