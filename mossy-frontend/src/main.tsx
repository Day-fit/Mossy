import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext.tsx';
import { EncryptionProvider } from './context/EncryptionContext.tsx';
import { VaultProvider } from './context/VaultContext.tsx';
import { DeviceKeyProvider } from './context/DeviceKeyContext.tsx';
import { DeviceBootstrapProvider } from './context/DeviceBootstrapContext.tsx';

const root = document.getElementById('root') as HTMLElement;

ReactDOM.createRoot(root).render(
	<BrowserRouter>
		<AuthProvider>
			<EncryptionProvider>
				<VaultProvider>
					<DeviceKeyProvider>
						<DeviceBootstrapProvider>
							<App />
						</DeviceBootstrapProvider>
					</DeviceKeyProvider>
				</VaultProvider>
			</EncryptionProvider>
		</AuthProvider>
	</BrowserRouter>
);
