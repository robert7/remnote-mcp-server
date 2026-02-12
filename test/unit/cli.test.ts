import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseCliArgs } from '../../src/cli.js';

describe('CLI Argument Parsing', () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;

  beforeEach(() => {
    // Mock process.exit to prevent test termination
    process.exit = vi.fn() as never;
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exit = originalExit;
  });

  describe('Default Values', () => {
    it('should return empty options when no arguments provided', () => {
      process.argv = ['node', 'remnote-mcp-server'];
      const options = parseCliArgs();
      expect(options).toEqual({});
    });
  });

  describe('Port Arguments', () => {
    it('should parse WebSocket port', () => {
      process.argv = ['node', 'remnote-mcp-server', '--ws-port', '4002'];
      const options = parseCliArgs();
      expect(options.wsPort).toBe(4002);
    });

    it('should parse HTTP port', () => {
      process.argv = ['node', 'remnote-mcp-server', '--http-port', '4001'];
      const options = parseCliArgs();
      expect(options.httpPort).toBe(4001);
    });

    it('should reject invalid port numbers', () => {
      process.argv = ['node', 'remnote-mcp-server', '--ws-port', 'invalid'];
      expect(() => parseCliArgs()).toThrow('Invalid port number');
    });

    it('should reject port numbers below 1', () => {
      process.argv = ['node', 'remnote-mcp-server', '--ws-port', '0'];
      expect(() => parseCliArgs()).toThrow('Invalid port number');
    });

    it('should reject port numbers above 65535', () => {
      process.argv = ['node', 'remnote-mcp-server', '--ws-port', '65536'];
      expect(() => parseCliArgs()).toThrow('Invalid port number');
    });

    it('should reject same port for WebSocket and HTTP', () => {
      process.argv = ['node', 'remnote-mcp-server', '--ws-port', '3000', '--http-port', '3000'];
      parseCliArgs();
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Log Level Arguments', () => {
    it('should parse console log level', () => {
      process.argv = ['node', 'remnote-mcp-server', '--log-level', 'debug'];
      const options = parseCliArgs();
      expect(options.logLevel).toBe('debug');
    });

    it('should parse file log level', () => {
      process.argv = ['node', 'remnote-mcp-server', '--log-level-file', 'warn'];
      const options = parseCliArgs();
      expect(options.logLevelFile).toBe('warn');
    });

    it('should accept all valid log levels', () => {
      const validLevels = ['debug', 'info', 'warn', 'error'];

      for (const level of validLevels) {
        process.argv = ['node', 'remnote-mcp-server', '--log-level', level];
        const options = parseCliArgs();
        expect(options.logLevel).toBe(level);
      }
    });

    it('should reject invalid log levels', () => {
      process.argv = ['node', 'remnote-mcp-server', '--log-level', 'invalid'];
      expect(() => parseCliArgs()).toThrow('Invalid log level');
    });

    it('should normalize log level to lowercase', () => {
      process.argv = ['node', 'remnote-mcp-server', '--log-level', 'DEBUG'];
      const options = parseCliArgs();
      expect(options.logLevel).toBe('debug');
    });
  });

  describe('Verbose Flag', () => {
    it('should set verbose flag', () => {
      process.argv = ['node', 'remnote-mcp-server', '--verbose'];
      const options = parseCliArgs();
      expect(options.verbose).toBe(true);
    });

    it('should work with other flags', () => {
      process.argv = ['node', 'remnote-mcp-server', '--verbose', '--ws-port', '4002'];
      const options = parseCliArgs();
      expect(options.verbose).toBe(true);
      expect(options.wsPort).toBe(4002);
    });
  });

  describe('File Logging Arguments', () => {
    it('should parse log file path', () => {
      process.argv = ['node', 'remnote-mcp-server', '--log-file', '/tmp/test.log'];
      const options = parseCliArgs();
      expect(options.logFile).toBe('/tmp/test.log');
    });

    it('should parse request log path', () => {
      process.argv = ['node', 'remnote-mcp-server', '--request-log', '/tmp/req.jsonl'];
      const options = parseCliArgs();
      expect(options.requestLog).toBe('/tmp/req.jsonl');
    });

    it('should parse response log path', () => {
      process.argv = ['node', 'remnote-mcp-server', '--response-log', '/tmp/resp.jsonl'];
      const options = parseCliArgs();
      expect(options.responseLog).toBe('/tmp/resp.jsonl');
    });
  });

  describe('Combined Arguments', () => {
    it('should parse multiple arguments together', () => {
      process.argv = [
        'node',
        'remnote-mcp-server',
        '--ws-port',
        '4002',
        '--http-port',
        '4001',
        '--log-level',
        'debug',
        '--log-file',
        '/tmp/test.log',
      ];
      const options = parseCliArgs();

      expect(options).toEqual({
        wsPort: 4002,
        httpPort: 4001,
        logLevel: 'debug',
        logFile: '/tmp/test.log',
      });
    });
  });
});
