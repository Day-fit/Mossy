import { describe, expect, it } from 'vitest';
import {
    normalizePasswordAddress,
    splitWebsiteAddress,
} from './passwordAddress.ts';
import type { PasswordFormState, WebsiteProtocol } from './index.ts';

function website(
    address: string,
    protocol: WebsiteProtocol = 'https://'
): PasswordFormState {
    return {
        identifier: 'demo',
        address,
        protocol,
        passwordType: 'PASSWORD',
        password: 'secret',
    };
}

describe('website addresses', () => {
    it('separates a pasted protocol from the editable address', () => {
        expect(
            splitWebsiteAddress('  HTTP://www.example.com:8080/login')
        ).toEqual({
            protocol: 'http://',
            address: 'www.example.com:8080/login',
        });
        expect(splitWebsiteAddress('example.com', 'http://')).toEqual({
            protocol: 'http://',
            address: 'example.com',
        });
    });

    it.each([
        [
            'www.example.com:8443/login?next=home#top',
            'https://',
            'https://www.example.com:8443',
        ],
        ['localhost:8080/sign-in', 'http://', 'http://localhost:8080'],
        ['https://example.com/login', 'https://', 'https://example.com'],
        ['example.com:443', 'https://', 'https://example.com'],
        ['example.com:80', 'http://', 'http://example.com'],
        ['[::1]:8080/login', 'http://', 'http://[::1]:8080'],
    ] as const)(
        'saves %s with its selected protocol and port',
        (input, protocol, expected) => {
            expect(normalizePasswordAddress(website(input, protocol))).toBe(
                expected
            );
        }
    );

    it.each([
        ' ',
        'not a host',
        'ftp://example.com',
        'user:secret@example.com',
    ])('rejects an invalid or credential-bearing address: %s', (input) => {
        expect(() => normalizePasswordAddress(website(input))).toThrow(
            'valid website address'
        );
    });
});

describe('SSH hosts', () => {
    it.each(['server.example:2222', 'ssh://server.example:2222'])(
        'saves %s without a protocol prefix',
        (address) => {
            expect(
                normalizePasswordAddress({
                    identifier: 'deploy',
                    address,
                    passwordType: 'SSH_KEY',
                    privateKey: 'key',
                })
            ).toBe('server.example:2222');
        }
    );
});
