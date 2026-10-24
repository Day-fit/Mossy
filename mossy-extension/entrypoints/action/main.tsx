import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import Action from '../../src/Action';
import '../../src/globals.css';

createRoot(document.getElementById('root')!).render(
    <MotionConfig reducedMotion="user">
        <Action />
    </MotionConfig>
);
