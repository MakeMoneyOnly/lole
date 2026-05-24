import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts', 'src/**/*.spec.tsx'],
        exclude: ['node_modules/', '.next/'],
        server: {
            deps: {
                inline: ['bcryptjs'],
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            bcryptjs: path.resolve(__dirname, '__mocks__/bcryptjs.ts'),
        },
    },
});
