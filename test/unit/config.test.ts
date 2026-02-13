import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig } from '../../src/config.js';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    delete process.env.REMNOTE_WS_PORT;
    delete process.env.REMNOTE_HTTP_PORT;
    delete process.env.REMNOTE_HTTP_HOST;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Port Configuration', () => {
    it('should use default ports when no CLI or env vars provided', () => {
      const config = getConfig({});
      expect(config.wsPort).toBe(3002);
      expect(config.httpPort).toBe(3001);
    });

    it('should use environment variables', () => {
      process.env.REMNOTE_WS_PORT = '4002';
      process.env.REMNOTE_HTTP_PORT = '4001';

      const config = getConfig({});
      expect(config.wsPort).toBe(4002);
      expect(config.httpPort).toBe(4001);
    });

    it('should prefer CLI options over environment variables', () => {
      process.env.REMNOTE_WS_PORT = '4002';
      process.env.REMNOTE_HTTP_PORT = '4001';

      const config = getConfig({ wsPort: 5002, httpPort: 5001 });
      expect(config.wsPort).toBe(5002);
      expect(config.httpPort).toBe(5001);
    });

    it('should throw error if ports are the same', () => {
      expect(() => getConfig({ wsPort: 3000, httpPort: 3000 })).toThrow(
        'WebSocket port and HTTP port cannot be the same'
      );
    });

    it('should throw error if WebSocket port is out of range', () => {
      expect(() => getConfig({ wsPort: 0 })).toThrow('Invalid WebSocket port');
      expect(() => getConfig({ wsPort: 65536 })).toThrow('Invalid WebSocket port');
    });

    it('should throw error if HTTP port is out of range', () => {
      expect(() => getConfig({ httpPort: 0 })).toThrow('Invalid HTTP port');
      expect(() => getConfig({ httpPort: 65536 })).toThrow('Invalid HTTP port');
    });
  });

  describe('Log Level Configuration', () => {
    it('should default to info log level', () => {
      const config = getConfig({});
      expect(config.logLevel).toBe('info');
    });

    it('should use CLI log level', () => {
      const config = getConfig({ logLevel: 'debug' });
      expect(config.logLevel).toBe('debug');
    });

    it('should override log level with verbose flag', () => {
      const config = getConfig({ logLevel: 'info', verbose: true });
      expect(config.logLevel).toBe('debug');
    });

    it('should set file log level to match console level when log file is provided', () => {
      const config = getConfig({ logLevel: 'warn', logFile: '/tmp/test.log' });
      expect(config.logLevelFile).toBe('warn');
    });

    it('should use explicit file log level', () => {
      const config = getConfig({
        logLevel: 'info',
        logLevelFile: 'debug',
        logFile: '/tmp/test.log',
      });
      expect(config.logLevelFile).toBe('debug');
    });

    it('should not set file log level when no log file is provided', () => {
      const config = getConfig({ logLevel: 'info' });
      expect(config.logLevelFile).toBeUndefined();
    });
  });

  describe('File Logging Configuration', () => {
    it('should include log file path when provided', () => {
      const config = getConfig({ logFile: '/tmp/test.log' });
      expect(config.logFile).toBe('/tmp/test.log');
    });

    it('should include request log path when provided', () => {
      const config = getConfig({ requestLog: '/tmp/req.jsonl' });
      expect(config.requestLog).toBe('/tmp/req.jsonl');
    });

    it('should include response log path when provided', () => {
      const config = getConfig({ responseLog: '/tmp/resp.jsonl' });
      expect(config.responseLog).toBe('/tmp/resp.jsonl');
    });

    it('should not include file paths when not provided', () => {
      const config = getConfig({});
      expect(config.logFile).toBeUndefined();
      expect(config.requestLog).toBeUndefined();
      expect(config.responseLog).toBeUndefined();
    });
  });

  describe('Pretty Logs Configuration', () => {
    it('should set prettyLogs based on TTY status', () => {
      const config = getConfig({});
      // This will depend on the test environment's TTY status
      expect(typeof config.prettyLogs).toBe('boolean');
    });
  });

  describe('Host Configuration', () => {
    it('should default to localhost for both servers', () => {
      const config = getConfig({});
      expect(config.wsHost).toBe('127.0.0.1');
      expect(config.httpHost).toBe('127.0.0.1');
    });

    it('should use REMNOTE_HTTP_HOST environment variable for HTTP server', () => {
      process.env.REMNOTE_HTTP_HOST = '0.0.0.0';

      const config = getConfig({});
      expect(config.httpHost).toBe('0.0.0.0');
    });

    it('should prefer CLI httpHost option over environment variable', () => {
      process.env.REMNOTE_HTTP_HOST = '0.0.0.0';

      const config = getConfig({ httpHost: '192.168.1.1' });
      expect(config.httpHost).toBe('192.168.1.1');
    });

    it('should ALWAYS use localhost for WebSocket server regardless of environment variable', () => {
      // This is a security feature - WebSocket server must never be exposed
      process.env.REMNOTE_WS_HOST = '0.0.0.0';

      const config = getConfig({});
      expect(config.wsHost).toBe('127.0.0.1'); // Hardcoded, ignores env var
    });

    it('should allow 0.0.0.0 for HTTP server (ngrok mode)', () => {
      const config = getConfig({ httpHost: '0.0.0.0' });
      expect(config.httpHost).toBe('0.0.0.0');
    });
  });

  describe('Complete Configuration', () => {
    it('should merge all configuration options correctly', () => {
      process.env.REMNOTE_WS_PORT = '4002';

      const config = getConfig({
        httpPort: 4001,
        logLevel: 'debug',
        logFile: '/tmp/test.log',
        requestLog: '/tmp/req.jsonl',
        responseLog: '/tmp/resp.jsonl',
      });

      expect(config).toMatchObject({
        wsPort: 4002, // from env
        wsHost: '127.0.0.1', // always localhost
        httpPort: 4001, // from CLI
        httpHost: '127.0.0.1', // default
        logLevel: 'debug',
        logLevelFile: 'debug', // derived from logLevel + logFile
        logFile: '/tmp/test.log',
        requestLog: '/tmp/req.jsonl',
        responseLog: '/tmp/resp.jsonl',
      });
    });
  });
});
