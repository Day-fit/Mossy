const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const SYNC_CODE_INPUT_PATTERN = `^[${CODE_ALPHABET}${CODE_ALPHABET.toLowerCase()}]*$`;

export function normalizeSyncCode(code: string): string {
    return code.replace(/[\s-]/g, '').toUpperCase();
}

export function isSyncCode(code: string): boolean {
    return (
        code.length === 6 &&
        [...code].every((character) => CODE_ALPHABET.includes(character))
    );
}
