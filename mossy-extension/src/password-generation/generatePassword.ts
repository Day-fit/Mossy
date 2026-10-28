import { customAlphabet } from 'nanoid';

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const PASSWORD_LENGHT = 24;

export function generatePassword(): string {
    return customAlphabet(BASE58, PASSWORD_LENGHT)();
}
