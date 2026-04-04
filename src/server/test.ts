import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
  AdapterEnvironmentCheck,
} from '@paperclipai/adapter-utils';
import { asString } from '@paperclipai/adapter-utils/server-utils';

const execAsync = promisify(exec);

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const command = asString(ctx.config.command, 'copilot');

  // Check if copilot CLI is installed
  try {
    const { stdout } = await execAsync(`${command} --version`);
    const version = stdout.trim();
    checks.push({
      code: 'copilot_installed',
      level: 'info',
      message: `Copilot CLI found: ${version}`,
    });
  } catch {
    checks.push({
      code: 'copilot_not_found',
      level: 'error',
      message: `\`${command}\` not found in PATH`,
      hint: 'Install GitHub Copilot CLI: https://docs.github.com/en/copilot/using-github-copilot/using-github-copilot-in-the-command-line',
    });
    return {
      adapterType: 'copilot-local',
      status: 'fail',
      checks,
      testedAt: new Date().toISOString(),
    };
  }

  // Check if copilot is authenticated
  try {
    const { stdout } = await execAsync(`${command} auth status`);
    if (stdout.includes('Logged in') || stdout.includes('authenticated')) {
      checks.push({
        code: 'copilot_auth',
        level: 'info',
        message: 'Copilot CLI is authenticated',
      });
    } else {
      checks.push({
        code: 'copilot_auth_unknown',
        level: 'warn',
        message: 'Could not confirm authentication status',
        hint: 'Run `copilot login` to authenticate',
      });
    }
  } catch {
    checks.push({
      code: 'copilot_auth_check_failed',
      level: 'warn',
      message: 'Could not verify authentication (may still work)',
      hint: 'Run `copilot login` if agents fail to start',
    });
  }

  const hasError = checks.some((c) => c.level === 'error');
  const hasWarn = checks.some((c) => c.level === 'warn');

  return {
    adapterType: 'copilot-local',
    status: hasError ? 'fail' : hasWarn ? 'warn' : 'pass',
    checks,
    testedAt: new Date().toISOString(),
  };
}
