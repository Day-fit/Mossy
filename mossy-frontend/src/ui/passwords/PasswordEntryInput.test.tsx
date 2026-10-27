import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PasswordEntryInput from './PasswordEntryInput.tsx';
import { splitWebsiteAddress } from './passwordAddress.ts';
import type { PasswordFormState } from './index.ts';

afterEach(cleanup);

function renderForm(initialState?: PasswordFormState, isEditing = false) {
    const onSubmit = vi.fn().mockResolvedValue('failed');
    render(
        <PasswordEntryInput
            initialState={initialState}
            isEditing={isEditing}
            isSubmitting={false}
            isVaultOnline
            onSubmit={onSubmit}
            onCancel={vi.fn()}
        />
    );

    return onSubmit;
}

function submit() {
    fireEvent.submit(screen.getByRole('form'));
}

it('defaults to HTTPS and adopts a pasted HTTP URL without duplicating the prefix', async () => {
    const onSubmit = renderForm();
    expect(
        (screen.getByLabelText('Website protocol') as HTMLSelectElement).value
    ).toBe('https://');

    fireEvent.change(screen.getByLabelText('Username or email'), {
        target: { value: 'demo' },
    });
    fireEvent.change(screen.getByLabelText('Website'), {
        target: { value: 'http://www.example.com:8080/login' },
    });
    fireEvent.change(screen.getByLabelText('Password', { selector: 'input' }), {
        target: { value: 'secret' },
    });

    expect(
        (screen.getByLabelText('Website protocol') as HTMLSelectElement).value
    ).toBe('http://');
    expect((screen.getByLabelText('Website') as HTMLInputElement).value).toBe(
        'www.example.com:8080/login'
    );

    submit();

    await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                address: 'http://www.example.com:8080',
                protocol: 'http://',
            })
        )
    );
});

it('loads a saved protocol into the edit selector and saves a changed selection', async () => {
    const onSubmit = renderForm(
        {
            identifier: 'demo',
            ...splitWebsiteAddress('http://example.com:8080'),
            passwordType: 'PASSWORD',
            password: 'new secret',
        },
        true
    );

    expect(
        (screen.getByLabelText('Website protocol') as HTMLSelectElement).value
    ).toBe('http://');
    expect((screen.getByLabelText('Website') as HTMLInputElement).value).toBe(
        'example.com:8080'
    );

    fireEvent.change(screen.getByLabelText('Website protocol'), {
        target: { value: 'https://' },
    });
    submit();

    await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                address: 'https://example.com:8080',
                protocol: 'https://',
            })
        )
    );
});

it('uses a plain SSH host and returns to HTTPS when switching back to a password', async () => {
    const onSubmit = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'SSH key' }));

    expect(screen.queryByLabelText('Website protocol')).toBeNull();
    fireEvent.change(screen.getByLabelText('Identifier'), {
        target: { value: 'deploy' },
    });
    fireEvent.change(screen.getByLabelText('Host'), {
        target: { value: 'server.example:2222' },
    });
    fireEvent.change(screen.getByLabelText(/Private key/), {
        target: {
            value: '-----BEGIN OPENSSH PRIVATE KEY-----\nfixture-key\n-----END OPENSSH PRIVATE KEY-----',
        },
    });
    submit();

    await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                address: 'server.example:2222',
                passwordType: 'SSH_KEY',
            })
        )
    );
    expect(onSubmit.mock.lastCall![0]).not.toHaveProperty('protocol');

    fireEvent.click(screen.getByRole('button', { name: 'Password' }));
    expect(
        (screen.getByLabelText('Website protocol') as HTMLSelectElement).value
    ).toBe('https://');
    expect((screen.getByLabelText('Website') as HTMLInputElement).value).toBe(
        'server.example:2222'
    );
});

it('shows an address validation error instead of submitting malformed data', async () => {
    const onSubmit = renderForm({
        identifier: 'demo',
        address: 'not a host',
        protocol: 'https://',
        passwordType: 'PASSWORD',
        password: 'secret',
    });
    submit();

    expect(await screen.findByRole('alert')).toHaveProperty(
        'textContent',
        expect.stringContaining('valid website address')
    );
    expect(onSubmit).not.toHaveBeenCalled();
});

it('keeps a typed password when the active type is clicked again', () => {
    renderForm();
    const password = screen.getByLabelText('Password', { selector: 'input' });
    fireEvent.change(password, { target: { value: 'keep this secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Password' }));

    expect((password as HTMLInputElement).value).toBe('keep this secret');
});
