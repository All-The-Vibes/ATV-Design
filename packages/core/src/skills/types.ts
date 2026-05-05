// Canonical definitions live in @atv-design/shared to avoid a
// circular dependency: packages/providers needs LoadedSkill but
// packages/providers is already a dependency of packages/core.
// Re-export here so skill-internal code can import from './types.js'.
export { SkillFrontmatterV1 } from '@atv-design/shared';
export type { LoadedSkill } from '@atv-design/shared';
