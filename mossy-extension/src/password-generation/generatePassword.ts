import { customAlphabet } from 'nanoid';

const ALPHABET = '123456789!@#$%^&*()ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const PASSWORD_LENGHT = 24;

export function generatePassword(): string {
    return customAlphabet(ALPHABET, PASSWORD_LENGHT)();
}
