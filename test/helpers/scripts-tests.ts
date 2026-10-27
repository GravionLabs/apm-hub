/** test/packages files that spawn processes; every other test/packages file is `unit`. */
export const scriptsTests = [
  'test/packages/delivery/apm-install.test.ts',
  'test/packages/github/release-guards.test.ts',
  'test/packages/hooks/git-guardrails.test.ts',
  'test/packages/hooks/git-guardrails-targets.test.ts',
  'test/packages/hooks/git-guardrails-nojq.test.ts',
  'test/packages/hooks/git-guardrails-hardening.test.ts',
  'test/packages/statusline/statusline.test.ts',
  'test/packages/shared/detect-techstack.test.ts',
  'test/packages/shared/detect-techstack-no-state.test.ts',
  'test/packages/shared/format-changed.test.ts',
  'test/packages/shared/pwsh-worker.test.ts',
];
