export async function* readSseData(response: Response): AsyncGenerator<string> {
    if (!response.body) {
        throw new Error('The event stream is unavailable.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value, { stream: !done });

            let separator: RegExpExecArray | null;

            while ((separator = /\r\n\r\n|\n\n|\r\r/.exec(buffer))) {
                const frame = buffer.slice(0, separator.index);
                buffer = buffer.slice(separator.index + separator[0].length);

                const lines = frame
                    .split(/\r\n|\n|\r/)
                    .filter(
                        (line) => line === 'data' || line.startsWith('data:')
                    )
                    .map((line) => line.slice(5).replace(/^ /, ''));

                if (lines.length) {
                    yield lines.join('\n');
                }
            }

            if (done) {
                return;
            }
        }
    } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
}
