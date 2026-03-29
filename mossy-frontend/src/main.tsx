import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext.tsx';
import { EncryptionProvider } from './context/EncryptionContext.tsx';

const root = document.getElementById('root') as HTMLElement;

ReactDOM.createRoot(root).render(
	<BrowserRouter>
		<AuthProvider>
			<EncryptionProvider>
				<App />
			</EncryptionProvider>
		</AuthProvider>
	</BrowserRouter>
);
