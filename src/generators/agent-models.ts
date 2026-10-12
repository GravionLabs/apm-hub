/** Single source of truth for model ids allowed in agent frontmatter. */
export const CLAUDE_MODEL_ALIASES = ['haiku', 'sonnet', 'opus', 'inherit'] as const;

/** OpenCode ids per tier. Add the opus id here when an agent first uses opus. */
export const OPENCODE_MODEL_IDS = ['anthropic/claude-haiku-5-5', 'anthropic/claude-sonnet-5-5'] as const;
