// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isNewPasswordField } from './isNewPasswordField';
import { fillGeneratedPassword } from './fillGeneratedPassword';
import { generatePassword } from './generatePassword';

vi.mock('./generatePassword', () => ({ generatePassword: vi.fn() }));

let field: HTMLInputElement;

beforeEach(() => {
    vi.spyOn(document, 'URL', 'get').mockReturnValue('https://github.com/signup');
    Object.defineProperty(HTMLInputElement.prototype, 'checkVisibility', {
        configurable: true,
        value: () => true,
    });
    document.body.innerHTML = `
        <form>
            <input type="email" name="user[email]" value="alice@example.com">
            <input type="password" id="password" name="user[password]" autocomplete="off">
        </form>
    `;
    field = document.querySelector<HTMLInputElement>('#password')!;
    vi.mocked(generatePassword).mockReturnValue('generated-secret');
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    Reflect.deleteProperty(HTMLInputElement.prototype, 'checkVisibility');
    document.body.replaceChildren();
});

describe('new password detection', () => {
    it.each(['off', '', 'new-password', 'section-signup new-password'])(
        'recognizes and fills the GitHub signup password with autocomplete="%s"',
        (autocomplete) => {
            field.setAttribute('autocomplete', autocomplete);

            expect(isNewPasswordField(field)).toBe(true);
            fillGeneratedPassword(field);

            expect(field.value).toBe('generated-secret');
            expect(document.querySelector('input[type=email]')).toHaveProperty(
                'value',
                'alice@example.com'
            );
        }
    );

    it.each(['current-password', 'section-account current-password'])(
        'respects explicit %s even on signup',
        (autocomplete) => {
            field.setAttribute('autocomplete', autocomplete);

            expect(isNewPasswordField(field)).toBe(false);
            expect(() => fillGeneratedPassword(field)).toThrow('field changed');
            expect(generatePassword).not.toHaveBeenCalled();
        }
    );

    it('excludes unrelated password fields and non-password inputs', () => {
        field.name = 'other';
        expect(isNewPasswordField(field)).toBe(false);
        field.name = 'password';
        field.type = 'text';
        field.autocomplete = 'new-password';
        expect(isNewPasswordField(field)).toBe(false);
    });
});
