import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const useMocks = mode === 'mock';

	const mockProxy = {
		'/api': {
			target: 'http://localhost:3001',
			changeOrigin: true,
			secure: false,
			xfwd: true,
			ws: true,
		},
	};

	const prodProxy = {
		'/api/v1/device-trust': {
			target: 'http://localhost:8086',
			changeOrigin: true,
			secure: false,
			xfwd: true,
		},
		'/api/v1/auth': {
			target: 'http://localhost:8083',
			changeOrigin: true,
			secure: false,
			xfwd: true,
		},
		'/api/v1/passwords': {
			target: 'http://localhost:8082',
			changeOrigin: true,
			secure: false,
			xfwd: true,
		},
		'/api/v1/device': {
			target: 'http://localhost:8081',
			changeOrigin: true,
			secure: false,
			xfwd: true,
		},
		'/api/v1/key-sync': {
			target: 'http://localhost:8081',
			changeOrigin: true,
			secure: false,
			xfwd: true,
		},
		'/api/v1/ws/key-sync': {
			target: 'http://localhost:8081',
			changeOrigin: true,
			secure: false,
			xfwd: true,
			ws: true,
		},
		'/api/v1/statistics': {
			target: 'http://localhost:8085',
			changeOrigin: true,
			secure: false,
			xfwd: true,
		},
	};

	const proxy = useMocks ? mockProxy : prodProxy;

	return {
		server: {
			proxy,
		},

		plugins: [
			tailwindcss(),
			react({
				babel: {
					plugins: [['babel-plugin-react-compiler']],
				},
			}),
		],

		define: {
			global: 'globalThis',
		},
	};
});
