import { join } from 'node:path';
import { EnvService } from './env.service';

describe('EnvService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('port', () => {
    it('uses the value from PORT when it is a valid positive integer', () => {
      process.env.PORT = '3000';

      expect(new EnvService().port).toBe(3000);
    });

    it('defaults to 8080 when PORT is unset', () => {
      delete process.env.PORT;

      expect(new EnvService().port).toBe(8080);
    });

    it.each([
      ['an empty string', ''],
      ['a non-numeric string', 'abc'],
      ['zero', '0'],
      ['a negative number', '-1'],
      ['a decimal number', '3000.5'],
    ])('defaults to 8080 when PORT is %s', (_label, value) => {
      process.env.PORT = value;

      expect(new EnvService().port).toBe(8080);
    });
  });

  describe('usageDbPath', () => {
    it('uses the value from USAGE_DB_PATH when set', () => {
      process.env.USAGE_DB_PATH = '/custom/usage.db';

      expect(new EnvService().usageDbPath).toBe('/custom/usage.db');
    });

    it('defaults to ./data/usage.db when USAGE_DB_PATH is unset', () => {
      delete process.env.USAGE_DB_PATH;

      expect(new EnvService().usageDbPath).toBe(
        join(process.cwd(), 'data', 'usage.db'),
      );
    });

    it('defaults to ./data/usage.db when USAGE_DB_PATH is an empty string', () => {
      process.env.USAGE_DB_PATH = '';

      expect(new EnvService().usageDbPath).toBe(
        join(process.cwd(), 'data', 'usage.db'),
      );
    });
  });
});
