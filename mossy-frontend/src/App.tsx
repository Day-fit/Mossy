import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './routes/Home.tsx';
import Register from './routes/Register.tsx';
import Passwords from './routes/Passwords.tsx';
import Login from './routes/Login.tsx';
import Layout from './routes/Layout.tsx';
import Dashboard from './routes/Dashboard.tsx';
import Vaults from './routes/Vaults.tsx';
import KeySyncHero from './ui/keysync/KeySyncHero.tsx';
import { useAuthInit } from './hooks/useAuthInit.ts';
import { useVaultInit } from './hooks/useVaultInit.ts';
import { useAuthStore } from './store/authStore.ts';
import { useDeviceBootstrap } from './hooks/useDeviceBootstrap.ts';

function App() {
	useAuthInit();
	useVaultInit();

	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
	const userId = useAuthStore((state) => state.userDetails?.userId);

	const { bootstrapDevice } = useDeviceBootstrap();

	useEffect(() => {
		if (!isAuthenticated || !userId) return;
		void bootstrapDevice();
	}, [bootstrapDevice, isAuthenticated, userId]);

	if (isAuthenticated === null) {
		return null;
	}

	return (
		<Routes>
			<Route element={<Layout />}>
				<Route path="/" element={<Home />} />
				<Route path="/dashboard" element={<Dashboard />} />
				<Route path={'/key-sync'} element={<KeySyncHero />} />
				<Route path="/vaults" element={<Vaults />} />
				<Route path="/passwords" element={<Passwords />} />
				<Route path="/register" element={<Register />} />
				<Route path="/login" element={<Login />} />
			</Route>
		</Routes>
	);
}

export default App;
