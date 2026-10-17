import { z } from 'zod';
import { readSseData } from '../api/sse.ts';

const resultSchema = z.object({
    receiverId: z.string(),
    result: z.enum(['SUCCESS', 'FAILED']),
    errorMessage: z.string().nullable().optional(),
});

export async function waitForReceiverResult(
    response: Response,
    receiverId: string
): Promise<void> {
    for await (const data of readSseData(response)) {
        const event = resultSchema.parse(JSON.parse(data));
        if (event.receiverId !== receiverId) continue;
        if (event.result === 'FAILED') {
            throw new Error(
                event.errorMessage ||
                    'The sending device could not upload the key.'
            );
        }
        return;
    }
    throw new Error(
        'The connection closed before the key arrived. Please try again.'
    );
}
