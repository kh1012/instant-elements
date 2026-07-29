import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { packageRoot } from "../pkg.js";

/** 이 패키지가 배포하는 스킬. 단계가 늘면 여기에 더한다. */
export const SKILL_NAMES = ["element-create"] as const;
export type SkillName = (typeof SKILL_NAMES)[number];

export function isSkillName(value: string): value is SkillName {
  return (SKILL_NAMES as readonly string[]).includes(value);
}

/** 에이전트별 스킬 설치 위치. Claude Code 와 Codex 가 각각 자기 디렉토리만 자동 탐색한다. */
export const AGENT_DIRS: Record<string, string> = {
  claude: ".claude/skills",
  codex: ".agents/skills",
};

export const skillsDir = join(packageRoot, "skills");

export function shippedSkillDir(name: SkillName): string {
  return join(skillsDir, name);
}

/**
 * GUIDE 정본 경로.
 *
 * 프로젝트 안의 `.instant/skills/<name>/GUIDE.md` 가 있으면 그쪽이 이긴다 — 팀이 자기 규칙을
 * 덧붙이거나 문구를 다듬을 수 있게 열어 둔 자리다. 없으면 패키지가 배포한 정본을 쓴다.
 *
 * 이 구조가 원본 하네스의 "git-tracked GUIDE 를 pull 로 전파" 모델을 대체한다.
 * npm 배포에서는 `npm update` 가 그 역할을 하고, 스텁은 거의 바뀌지 않으므로 재설치가 필요 없다.
 */
export function resolveGuidePath(name: SkillName, projectRoot: string): string | null {
  const override = join(projectRoot, ".instant", "skills", name, "GUIDE.md");
  if (existsSync(override)) return override;
  const shipped = join(shippedSkillDir(name), "GUIDE.md");
  return existsSync(shipped) ? shipped : null;
}

export function readGuide(name: SkillName, projectRoot: string): { path: string; body: string } | null {
  const path = resolveGuidePath(name, projectRoot);
  if (!path) return null;
  try {
    return { path, body: readFileSync(path, "utf8") };
  } catch {
    return null;
  }
}
