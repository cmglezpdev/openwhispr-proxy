/**
 * Global test setup.
 *
 * The `ai` and `@ai-sdk/gateway` packages are ESM-only, so Jest (running in
 * CommonJS) cannot load them at all. Mocking them here serves two purposes:
 *
 *  1. it keeps every suite loadable, including the ones that only import a
 *     controller and never touch the SDK directly;
 *  2. it makes it impossible for a test to reach the real AI Gateway, so no
 *     suite can ever hit the network or spend credit.
 *
 * Each test file gets a fresh module registry, so the mocks below are new
 * `jest.fn()` instances per suite. Configure them from the test itself, e.g.
 * `(transcribe as unknown as jest.Mock).mockResolvedValue(...)`.
 */
jest.mock('ai', () => ({
  transcribe: jest.fn(),
  generateText: jest.fn(),
}));

jest.mock('@ai-sdk/gateway', () => ({
  createGateway: jest.fn(),
}));

// Keep the reporter readable: application logs (including the expected error
// logs of the failure-path tests) would otherwise bury the actual assertions.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Logger } = require('@nestjs/common') as typeof import('@nestjs/common');
Logger.overrideLogger(false);

export {};
