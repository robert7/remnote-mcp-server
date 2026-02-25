import { describe, it, expect } from 'vitest';
import { checkVersionCompatibility } from '../../src/version-compat.js';

describe('checkVersionCompatibility', () => {
  it('should return null for matching major.minor versions', () => {
    expect(checkVersionCompatibility('0.5.0', '0.5.0')).toBeNull();
    expect(checkVersionCompatibility('0.5.1', '0.5.2')).toBeNull();
    expect(checkVersionCompatibility('0.5.0', '0.5.99')).toBeNull();
    expect(checkVersionCompatibility('1.2.0', '1.2.5')).toBeNull();
  });

  it('should return warning for different minor versions', () => {
    const result = checkVersionCompatibility('0.5.0', '0.6.0');
    expect(result).toContain('Version mismatch');
    expect(result).toContain('0.5.0');
    expect(result).toContain('0.6.0');
  });

  it('should return warning for different major versions', () => {
    const result = checkVersionCompatibility('1.0.0', '2.0.0');
    expect(result).toContain('Version mismatch');
  });

  it('should return error for unparseable versions', () => {
    const result = checkVersionCompatibility('invalid', '0.5.0');
    expect(result).toContain('Cannot parse');
  });

  it('should return error when bridge version is unparseable', () => {
    const result = checkVersionCompatibility('0.5.0', 'bad');
    expect(result).toContain('Cannot parse');
  });

  it('should handle pre-release suffixes by parsing leading semver', () => {
    expect(checkVersionCompatibility('0.5.0-beta.1', '0.5.0')).toBeNull();
  });
});
