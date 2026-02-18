import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';

describe('run-status-check.sh', () => {
  const scriptPath = resolve(process.cwd(), 'run-status-check.sh');
  const helperPath = resolve(process.cwd(), 'scripts', 'run-status-check.mjs');

  it('should be executable', () => {
    const stats = statSync(scriptPath);
    expect(stats.mode & 0o111).not.toBe(0);
  });

  it('should include the extracted helper script', () => {
    expect(() => statSync(helperPath)).not.toThrow();
  });

  it('should fail clearly when server is unreachable', () => {
    const result = spawnSync('bash', [scriptPath], {
      cwd: process.cwd(),
      encoding: 'utf-8',
      env: {
        ...process.env,
        REMNOTE_MCP_URL: 'http://127.0.0.1:1',
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Status check failed:');
  });
});
