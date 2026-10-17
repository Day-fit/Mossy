// Run before CSS and React so the first paint uses the saved preference.
// Keep these values and the storage key aligned with store/themeStore.ts.
(function () {
    let preference = 'system';
    try {
        const saved = window.localStorage.getItem('mossy.theme');
        if (saved === 'system' || saved === 'light' || saved === 'dark') {
            preference = saved;
        }
    } catch {
        // CSS can follow the device theme even when storage is unavailable.
    }
    document.documentElement.dataset.theme = preference;
})();
