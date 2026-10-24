import React from 'react';
import { MotionConfig } from 'framer-motion';
import { createRoot } from 'react-dom/client';
import Popup from '../../src/Popup';
import '../../src/globals.css';

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <MotionConfig reducedMotion="user">
            <Popup />
        </MotionConfig>
    </React.StrictMode>
);
