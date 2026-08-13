import { Routes, Route } from 'react-router-dom';
import Home from './routes/Home.tsx';
import Register from './routes/Register.tsx';
import Passwords from './routes/Passwords.tsx';
import Login from './routes/Login.tsx';
import Layout from './routes/Layout.tsx';
import Dashboard from './routes/Dashboard.tsx';
import Vaults from './routes/Vaults.tsx';
import { useAuthInit } from './hooks/useAuthInit.ts';
import { useVaultInit } from './hooks/useVaultInit.ts';
import KeySync from './routes/KeySync.tsx';
import { useAuthStore } from './store/authStore.ts';
import Devices from './routes/Devices.tsx';
import { useDevicesInit } from './hooks/useDevicesInit.ts';

function App() {
	useAuthInit();
	useVaultInit();
	useDevicesInit();
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

	if (isAuthenticated === null) return null;

	return (
		<Routes>
			<Route element={<Layout />}>
				<Route path="/" element={<Home />} />
				<Route path="/dashboard" element={<Dashboard />} />
				<Route path={'/key-sync'} element={<KeySync />} />
				<Route path="/vaults" element={<Vaults />} />
				<Route path="/devices" element={<Devices />} />
				<Route path="/passwords" element={<Passwords />} />
				<Route path="/register" element={<Register />} />
				<Route path="/login" element={<Login />} />
			</Route>
		</Routes>
	);
}

export default App;
