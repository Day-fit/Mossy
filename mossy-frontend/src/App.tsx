import { Routes, Route } from 'react-router-dom';
import Home from './routes/Home.tsx';
import Register from './routes/Register.tsx';
import Passwords from './routes/Passwords.tsx';
import Login from './routes/Login.tsx';
import Layout from './routes/Layout.tsx';
import Dashboard from './routes/Dashboard.tsx';
import Vaults from './routes/Vaults.tsx';
import KeySyncHero from './ui/keysync/KeySyncHero.tsx';

function App() {
	return (
		<Routes>
			<Route element={<Layout />}>
				<Route path="/" element={<Home />} />
				<Route path="/dashboard" element={<Dashboard />} />
				<Route path={'/keysync/:code'} element={<KeySyncHero />} />
				<Route path="/vaults" element={<Vaults />} />
				<Route path="/passwords" element={<Passwords />} />
				<Route path="/register" element={<Register />} />
				<Route path="/login" element={<Login />} />
			</Route>
		</Routes>
	);
}

export default App;
