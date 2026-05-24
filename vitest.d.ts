// Vitest type declarations
// These types are available globally in test files due to `globals: true` in vitest.config.ts

declare global {
    const vi: typeof import('vitest').vi;
    const expect: typeof import('vitest').expect;
    const describe: typeof import('vitest').describe;
    const it: typeof import('vitest').it;
    const beforeAll: typeof import('vitest').beforeAll;
    const afterAll: typeof import('vitest').afterAll;
    const beforeEach: typeof import('vitest').beforeEach;
    const afterEach: typeof import('vitest').afterEach;
}

export {};
