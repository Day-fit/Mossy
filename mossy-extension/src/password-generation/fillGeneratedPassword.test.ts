// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fillGeneratedPassword } from './fillGeneratedPassword';
import { generatePassword } from './generatePassword';
import { readForm } from '../capture/forms';

vi.mock('./generatePassword', () => ({ generatePassword: vi.fn() }));

let form: HTMLFormElement;
let current: HTMLInputElement;
let password: HTMLInputElement;
let confirmation: HTMLInputElement;

beforeEach(() => {
    Object.defineProperty(HTMLInputElement.prototype, 'checkVisibility', {
        configurable: true,
        value: vi.fn(() => true),
    });
    vi.mocked(generatePassword).mockReturnValue('generated-secret');

    document.body.innerHTML = `
        <form>
            <input name="username" autocomplete="username" value="alice">
            <input name="current" type="password" autocomplete="current-password" value="old-secret">
            <input name="password" type="password" autocomplete="new-password">
            <input name="confirmation" type="password" autocomplete="new-password">
        </form>
        <form><input name="other" type="password" autocomplete="new-password" value="other-secret"></form>
    `;
    form = document.forms[0]!;
    current = form.elements.namedItem('current') as HTMLInputElement;
    password = form.elements.namedItem('password') as HTMLInputElement;
    confirmation = form.elements.namedItem('confirmation') as HTMLInputElement;
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    Reflect.deleteProperty(HTMLInputElement.prototype, 'checkVisibility');
    document.body.replaceChildren();
});

describe('generated password insertion', () => {
    it('fills new passwords together before events and preserves the current password and other forms', () => {
        const changes: string[] = [];
        const submit = vi.fn();

        form.addEventListener('submit', submit);
        for (const field of [password, confirmation]) {
            for (const type of ['input', 'change']) {
                field.addEventListener(type, () => {
                    expect(password.value).toBe('generated-secret');
                    expect(confirmation.value).toBe('generated-secret');
                    changes.push(`${field.name}:${type}`);
                });
            }
        }

        fillGeneratedPassword(confirmation);

        expect(generatePassword).toHaveBeenCalledTimes(1);
        expect(changes).toEqual([
            'password:input',
            'password:change',
            'confirmation:input',
            'confirmation:change',
        ]);
        expect(current.value).toBe('old-secret');
        expect(
            (document.forms[1]!.elements.namedItem('other') as HTMLInputElement)
                .value
        ).toBe('other-secret');
        expect(readForm(form)?.username?.value).toBe('alice');
        expect(submit).not.toHaveBeenCalled();
    });

    it.each(['disabled', 'readOnly'] as const)(
        'skips %s confirmation fields',
        (attribute) => {
            confirmation[attribute] = true;

            fillGeneratedPassword(password);

            expect(password.value).toBe('generated-secret');
            expect(confirmation.value).toBe('');
        }
    );

    it('rejects a detached, hidden or repurposed anchor and never generates for current-password fields', () => {
        expect(() => fillGeneratedPassword(current)).toThrow('field changed');
        password.autocomplete = 'current-password';
        expect(() => fillGeneratedPassword(password)).toThrow('field changed');
        confirmation.remove();
        expect(() => fillGeneratedPassword(confirmation)).toThrow(
            'field changed'
        );
        password.autocomplete = 'new-password';
        vi.spyOn(password, 'checkVisibility').mockReturnValue(false);
        expect(() => fillGeneratedPassword(password)).toThrow('field changed');
        expect(generatePassword).not.toHaveBeenCalled();
    });

    it('leaves values unchanged when generation fails or returns an empty password', () => {
        vi.mocked(generatePassword).mockImplementationOnce(() => {
            throw new Error('Not implemented');
        });

        expect(() => fillGeneratedPassword(password)).toThrow(
            'Not implemented'
        );
        expect(password.value).toBe('');
        expect(confirmation.value).toBe('');

        vi.mocked(generatePassword).mockReturnValueOnce('');
        expect(() => fillGeneratedPassword(password)).toThrow('empty password');
        expect(password.value).toBe('');
    });
});
