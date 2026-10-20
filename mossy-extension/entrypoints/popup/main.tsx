import React from 'react';
import { createRoot } from 'react-dom/client';
import Popup from '../../src/Popup';
import '../../src/globals.css';

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Popup />
    </React.StrictMode>
);
