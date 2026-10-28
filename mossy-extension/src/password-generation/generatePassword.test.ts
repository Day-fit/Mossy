import { expect, it } from 'vitest';
import { generatePassword } from './generatePassword';

it('generates 24 Base58 characters with the configured alphabet', () => {
    const first = generatePassword();
    const second = generatePassword();

    expect(first).toMatch(/^[1-9A-HJ-NP-Za-km-z]{24}$/);
    expect(second).toMatch(/^[1-9A-HJ-NP-Za-km-z]{24}$/);
    expect(first).not.toBe(second);
});
