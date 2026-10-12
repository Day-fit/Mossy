import { afterEach, describe, expect, it, vi } from 'vitest';
import { tokenStorage } from '../auth/tokenStorage.ts';
import { receiveEnrollmentEvents } from './deviceTrust.api.ts';

const enrollment = {
    id: 'enrollment-1',
    lastOsName: 'Linux',
    deviceType: 'Desktop',
    remoteAddr: '192.0.2.1',
    createdAt: '2026-10-11T12:00:00Z',
};
function mockStream(chunks: string[]) {
    const encoder = new TextEncoder();
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
            new Response(
                new ReadableStream({
                    start(controller) {
                        chunks.forEach((chunk) =>
                            controller.enqueue(encoder.encode(chunk))
                        );
                        controller.close();
                    },
                }),
                { headers: { 'Content-Type': 'text/event-stream' } }
            )
        )
    );
}
afterEach(() => {
    vi.unstubAllGlobals();
    tokenStorage.set(null);
});
describe('enrollment event stream', () => {
    it('authenticates and parses split CRLF, multiline data and multiple events', async () => {
        tokenStorage.set('access-token');
        const json = JSON.stringify(enrollment);
        const split = json.indexOf(',') + 1;
        mockStream([
            ': heartbeat\r',
            '\ndata: ' +
                json.slice(0, split) +
                '\r\ndata: ' +
                json.slice(split) +
                '\r',
            '\n\r\ndata: ' + json + '\n\n',
        ]);
        const onEnrollment = vi.fn();
        const onOpen = vi.fn();
        const { signal } = new AbortController();
        await receiveEnrollmentEvents(signal, onEnrollment, onOpen);
        expect(fetch).toHaveBeenCalledWith(
            '/api/v1/device-trust/device/enrollments/events',
            expect.objectContaining({
                signal,
                credentials: 'include',
                headers: expect.objectContaining({
                    Authorization: 'Bearer access-token',
                    Accept: 'text/event-stream',
                }),
            })
        );
        expect(onOpen).toHaveBeenCalledOnce();
        expect(onEnrollment.mock.calls).toEqual([[enrollment], [enrollment]]);
    });
    it('ignores malformed and incomplete events while delivering valid data', async () => {
        const json = JSON.stringify(enrollment);
        mockStream([
            'data: invalid\n\ndata: {}\n\ndata: null\n\ndata: ' +
                json +
                '\n\ndata: ' +
                json,
        ]);
        const onEnrollment = vi.fn();
        await receiveEnrollmentEvents(
            new AbortController().signal,
            onEnrollment,
            vi.fn()
        );
        expect(onEnrollment).toHaveBeenCalledExactlyOnceWith(enrollment);
    });
});
