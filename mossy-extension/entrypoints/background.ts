import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
    void disableNativePasswordSaving()
    void import('../src/background/background.ts');
});

async function disableNativePasswordSaving(): Promise<void> {
    const setting = browser.privacy?.services?.passwordSavingEnabled;

    if(!setting) {
        return;
    } 

    const { levelOfControl } = await setting.get({})

    if(
        levelOfControl !== 'controllable_by_this_extension' &&
        levelOfControl !== 'controlled_by_this_extension'
    ) {
        return
    }

    await setting.set({ value: false })
}