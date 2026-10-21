import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
    void import('../src/background/background.ts');
    void import('../src/background/auth.background.ts');
});
