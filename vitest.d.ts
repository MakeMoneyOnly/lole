// Vitest type declarations
// These types are available globally in test files due to `globals: true` in vitest.config.ts

declare global {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vi: typeof import('vitest').vi;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expect: typeof import('vitest').expect;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const describe: typeof import('vitest').describe;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const it: typeof import('vitest').it;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const beforeAll: typeof import('vitest').beforeAll;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const afterAll: typeof import('vitest').afterAll;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const beforeEach: typeof import('vitest').beforeEach;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const afterEach: typeof import('vitest').afterEach;
}

export {};