import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleNameMapper: {
    '^@liquor/db$': '<rootDir>/../../packages/db/src/index.ts',
  },
  globalSetup: undefined,
  globalTeardown: undefined,
};

export default config;
