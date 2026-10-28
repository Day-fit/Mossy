import { defineContentScript } from 'wxt/utils/define-content-script';
import { registerCapture } from '../src/capture/registerCapture';

import { WEBSITE_ORIGINS } from '../src/security/website';

export default defineContentScript({
    matches: WEBSITE_ORIGINS,
    allFrames: true,
    registration: 'runtime',
    main: registerCapture,
});
