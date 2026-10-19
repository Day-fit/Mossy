import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './tests',
    timeout: 60000,
    workers: 1,
    fullyParallel: false,
    use: { trace: 'retain-on-failure' },
    reporter: 'list',
});
