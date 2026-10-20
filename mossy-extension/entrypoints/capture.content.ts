import { defineContentScript } from 'wxt/utils/define-content-script';
import { registerCapture } from '../src/capture/registerCapture';

export default defineContentScript({
    matches: ['https://*/*'],
    allFrames: true,
    registration: 'runtime',
    main: registerCapture,
});
