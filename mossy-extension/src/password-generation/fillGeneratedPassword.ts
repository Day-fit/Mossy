import { fillInputs, readForm } from '../capture/forms';
import { generatePassword } from './generatePassword';

export function fillGeneratedPassword(field: HTMLInputElement) {
    const record = field.form && readForm(field.form);
    const passwords = record?.passwords.filter(
        (input) => input.autocomplete === 'new-password'
    );

    if (!field.isConnected || !passwords?.includes(field)) {
        throw new Error('The password field changed. Try again.');
    }

    const password = generatePassword();

    if (!password) throw new Error('The generator returned an empty password.');

    fillInputs(passwords.map((input) => [input, password]));
}
