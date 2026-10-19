import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
    hooks: {
        'build:manifestGenerated': (_wxt, manifest) => {
            manifest.host_permissions = ['https://mossy.dayfit.pl/*'];
        },
    },
    modules: ['@wxt-dev/module-react'],
    vite: () => ({ plugins: [tailwindcss()] }),
    manifest: ({ mode }) => ({
        key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1+7HDHDEOWTi1vLuQVp2J7xKC8vJ6ZQXzxMuK6g/04wUbvdhCMU71v5YHbnXZR5Jkc7MtCkegtMcD31fndiF7vY2q7IBgtWKrArP+P7oyy0dMo4n3CQAzVWd78W5Mq/loRr8F46BlBMWDDV22K68Zr9Yhgriran+KBUs1lyunHf9KbOjOd5PMqtdXdqv+8qO5eOXdKsoqTAt+go25OKiCKP6PAUc8nA2k0eZ/czmFRwBNdauLEr4jWkyr8sz7k27J7qhSz335beuQ893ONIWhyHL6fTw20dWhCyr2Cyum5n+3lY5lLdzhp/qRLKe0GnqIlCmdTsz+El/fTFt08fyiQIDAQAB',
        icons: {
            16: 'mossy_logo_32.png',
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
            'tabs',
            'activeTab',
            'scripting',
            'clipboardWrite',
            'webNavigation',
        ],
        host_permissions: ['https://mossy.dayfit.pl/*'],
        optional_host_permissions: [
            'https://*/*',
            ...(mode === 'development'
                ? ['http://localhost/*', 'http://127.0.0.1/*']
                : []),
        ],
        content_security_policy: {
            extension_pages:
                "script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        },
    }),
});
