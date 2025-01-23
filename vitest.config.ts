import { defineConfig } from 'vitest/config'
import { sveltekit } from '@sveltejs/kit/vite'
import path from 'path'

export default defineConfig({
    plugins: [sveltekit()],
    test: {
        include: ['tests/**/*.{test,spec}.{js,ts}'],
        environment: 'node',
        setupFiles: ['tests/setup.ts'],
        alias: {
            '$lib': path.resolve(__dirname, './src/lib'),
            '$env/static/private': path.resolve(__dirname, './tests/mocks/env.ts')
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/**',
                'tests/**',
                '**/*.test.ts',
                '**/*.config.ts',
                '.svelte-kit/**'
            ]
        }
    }
})