import { CopilotClient, approveAll } from '@github/copilot-sdk';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(__dirname, '../../..');
export const SKILLS_DIR = resolve(REPO_ROOT, '.github/skills');
export const PACKAGES_DIR = resolve(REPO_ROOT, 'packages');

export function isCopilotAvailable(): boolean {
  return !!(process.env.COPILOT_CLI_PATH || process.env.COPILOT_INTEGRATION_TESTS);
}

export async function createTestClient(options?: {
  skillsDir?: string;
  extraEnv?: Record<string, string>;
}): Promise<CopilotClient> {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    ...(options?.extraEnv ?? {}),
  };
  if (options?.skillsDir) {
    env.COPILOT_SKILLS_DIRS = options.skillsDir;
  }

  const client = new CopilotClient({
    cliPath: process.env.COPILOT_CLI_PATH,
    env,
  });
  return client;
}

export async function createTestSession(options?: {
  skillsDir?: string;
  agentPrompt?: string;
  model?: string;
}) {
  const client = await createTestClient({ skillsDir: options?.skillsDir });
  const session = await client.createSession({
    onPermissionRequest: approveAll,
    // Deliberately pinned cheap test model (not an Anthropic id, so not covered by the
    // claude-api id list). Re-checked for #155: kept as is; bump by hand when it is retired
    // or override per test via options.model.
    model: options?.model ?? 'gpt-4.1-nano',
    ...(options?.agentPrompt
      ? {
          customAgents: [
            {
              name: 'test-agent',
              displayName: 'Test Agent',
              description: 'Integration test agent',
              prompt: options.agentPrompt,
            },
          ],
        }
      : {}),
  });
  return { client, session };
}
