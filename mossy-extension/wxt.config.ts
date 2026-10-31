import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { WEBSITE_ORIGINS } from './src/security/website';

export default defineConfig({
    hooks: {
        'build:manifestGenerated': (wxt, manifest) => {
            manifest.host_permissions = ['https://mossy.dayfit.pl/*'];
            if (wxt.server) {
                // Keep dev-server access while website access stays optional.
                const server = new URL(wxt.server.origin);
                server.port = '';
                manifest.host_permissions.push(`${server.origin}/*`);
            }
        },
    },
    modules: ['@wxt-dev/module-react'],
    vite: () => ({ plugins: [tailwindcss()] }),
    manifest: () => ({
        key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzo2ARL8/XAchAVXXOnm8h7j+SCf7L1XRq138wGx5Ziw5ih9W8Z7DxEE0J/vSBWwrZJjVywDip00kH4buAxnsqALmFIwnSUNbb1UJgRKqAU6GQw00MTj6C2SjXhvUCg1t955QTGjVw40k3dUSvR1lLucnz8b9Zo4qhi/1UvqQK83bsuJvl/IEBuQCnffEYkrJ0wPBBpfVfU9Xkq6Aoo1Dx8+nHGEzn7lxFbShWSlQrIfe13shtWPiGnUi9y+x90IWdjJQTY+doRWbXPKG/i4rmPnDPHoYTUIl21aPoR3JsF5UgFohSGUWrx4Y09KmoA8IKHfR4QKwdgDvEGn0kh6mswIDAQAB',
        icons: {
            16: 'mossy_logo_16.png',
            32: 'mossy_logo_32.png',
            48: 'mossy_logo_48.png',
            128: 'mossy_logo_128.png',
        },
        name: 'Mossy',
        description:
            'Your Mossy vault, with fresh authorization for every secret action.',
        minimum_chrome_version: '137',
        permissions: [
            'storage',
            'scripting',
            'privacy',
            'clipboardWrite',
            'webNavigation',
        ],
        host_permissions: ['https://mossy.dayfit.pl/*'],
        optional_host_permissions: WEBSITE_ORIGINS,
        content_security_policy: {
            extension_pages:
                "script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        },
    }),
});
