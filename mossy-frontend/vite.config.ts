import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({

    server: {
        proxy: {
            '/api/v1/auth': {
                target: 'http://localhost:8083',
                changeOrigin: true,
                secure: false,
            },
            '/api/v1/statistics': {
                target: 'http://localhost:8085',
                changeOrigin: true,
                secure: false,
            },
        }
    },

    plugins: [
        tailwindcss(),
        react({
            babel: {
                plugins: [['babel-plugin-react-compiler']],
            },
        }),
    ],
})
