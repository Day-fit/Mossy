import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { startThemePreferenceSync } from './store/themeStore.ts';

const stopThemeSync = startThemePreferenceSync();
if (import.meta.hot) import.meta.hot.dispose(stopThemeSync);

const root = document.getElementById('root') as HTMLElement;

ReactDOM.createRoot(root).render(
    <BrowserRouter>
        <App />
    </BrowserRouter>
);
