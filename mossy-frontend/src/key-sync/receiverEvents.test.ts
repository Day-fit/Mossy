import { describe, expect, it, vi } from 'vitest';
import { readSseData } from '../api/sse.ts';
import { waitForReceiverResult } from './receiverEvents.ts';

const encoder = new TextEncoder();

function response(text: string, close = true) {
    const cancel = vi.fn();
    return {
        response: new Response(
            new ReadableStream<Uint8Array>({
                start(controller) {
                    // Splitting every byte also splits UTF-8 characters and CRLF delimiters.
                    for (const byte of encoder.encode(text))
                        controller.enqueue(new Uint8Array([byte]));
                    if (close) controller.close();
                },
                cancel,
            })
        ),
        cancel,
    };
}

describe('receiver event stream', () => {
    it('reassembles fragmented, multiline data and ignores heartbeat comments', async () => {
        const stream = response(
            ':heartbeat\r\n\r\ndata: {"message":\r\ndata: "clé"}\r\n\r\n'
        );
        const messages = [];
        for await (const data of readSseData(stream.response))
            messages.push(JSON.parse(data));
        expect(messages).toEqual([{ message: 'clé' }]);
    });

    it('waits for this device result and closes the stream after success', async () => {
        const stream = response(
            ':heartbeat\n\ndata: {"receiverId":"other-device","result":"SUCCESS"}\n\n' +
                'data: {"receiverId":"receiver-device","result":"SUCCESS"}\n\n',
            false
        );
        await expect(
            waitForReceiverResult(stream.response, 'receiver-device')
        ).resolves.toBeUndefined();
        expect(stream.cancel).toHaveBeenCalledOnce();
    });

    it('exposes the receiver failure without treating it as a successful transfer', async () => {
        const stream = response(
            'data: {"receiverId":"receiver-device","result":"FAILED","errorMessage":"Invalid sender connected"}\n\n'
        );
        await expect(
            waitForReceiverResult(stream.response, 'receiver-device')
        ).rejects.toThrow('Invalid sender connected');
    });

    it('reports a disconnected stream instead of accepting an incomplete result', async () => {
        const stream = response(
            'data: {"receiverId":"receiver-device","result":"SUCCESS"}'
        );
        await expect(
            waitForReceiverResult(stream.response, 'receiver-device')
        ).rejects.toThrow('connection closed');
    });
});
