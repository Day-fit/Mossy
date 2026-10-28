import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 60000,
    workers: '50%',
    fullyParallel: true,
    use: { trace: 'retain-on-failure' },
    reporter: 'list',
});
