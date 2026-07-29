/** 레지스트리 공개 표면. CLI·갤러리·검증이 전부 여기를 통해 레지스트리를 다룬다. */
export type {
  Entry,
  EntryFile,
  EntryMeta,
  IndexComponent,
  PropSchema,
  PropType,
  RegistryIndex,
} from "./schema.js";
export { CATEGORIES, ENTRY_SCHEMA_URL, STATUSES, isCategory, isStatus } from "./schema.js";

export type { ElementPaths, RegistryDirs } from "./paths.js";
export { NAME_RE, assertValidName, elementPaths, isValidName, pascalCase } from "./paths.js";

export {
  entryExists,
  hasDemo,
  listEntries,
  listEntryNames,
  readEntry,
  tryReadEntry,
  validateEntry,
  writeEntry,
} from "./entry.js";

export type { BuildIndexDirs } from "./index-file.js";
export { INDEX_GENERATOR, INDEX_NOTE, buildIndex, writeIndex } from "./index-file.js";

export type { HistoryAction, HistoryEvent } from "./history.js";
export { HISTORY_ACTIONS, appendHistory, isHistoryAction, readHistory } from "./history.js";

export type { Classified } from "./io.js";
export { appendLine, readJsonClassified, readJsonl, writeJsonAtomic } from "./io.js";
