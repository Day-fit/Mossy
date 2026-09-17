import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import EmailConfirmation from './EmailConfirmation.tsx';
import { savePendingVerification } from '../../auth/pendingVerification.ts';
import { ApiError } from '../../api/client.ts';

const api = vi.hoisted(() => ({
    executeConfirmEmailRequest: vi.fn(),
    executeResendVerificationRequest: vi.fn(),
    executeRecoverVerificationRequest: vi.fn(),
}));
vi.mock('../../api/auth.api.ts', () => api);

function Login() {
    const location = useLocation();
    return (
        <p>{location.state?.emailVerified ? 'Verified, sign in' : 'Sign in'}</p>
    );
}

function show(entry = '/verify-email') {
    return render(
        <MemoryRouter initialEntries={[entry]}>
            <Routes>
                <Route path="/verify-email" element={<EmailConfirmation />} />
                <Route path="/login" element={<Login />} />
            </Routes>
        </MemoryRouter>
    );
}

function metadata(id = 'verification-1', expired = false) {
    return {
        verificationId: id,
        expiresAt: new Date(
            Date.now() + (expired ? -1 : 900_000)
        ).toISOString(),
        resendAvailableAt: new Date(Date.now() - 1000).toISOString(),
    };
}

function pending(expired = false) {
    savePendingVerification({
        verification: metadata('verification-1', expired),
        identifier: 'new@example.com',
    });
}

function pasteCode(code: string) {
    fireEvent.paste(screen.getByLabelText('Code digit 1'), {
        clipboardData: { getData: () => code },
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    api.executeConfirmEmailRequest.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('email confirmation', () => {
    it('restores pending metadata on reload and confirms a code including leading zeros', async () => {
        pending();
        const first = show();
        first.unmount();
        show();
        pasteCode('000123');
        fireEvent.click(screen.getByRole('button', { name: 'Confirm email' }));

        await screen.findByText('Verified, sign in');
        expect(api.executeConfirmEmailRequest).toHaveBeenCalledWith({
            verificationId: 'verification-1',
            code: '000123',
        });
        expect(sessionStorage.length).toBe(0);
    });

    it('opens an email link without submitting until the user clicks Confirm', async () => {
        const token = 'a'.repeat(43);
        show(`/verify-email#verificationId=link-verification&token=${token}`);
        expect(api.executeConfirmEmailRequest).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Confirm email' }));

        await screen.findByText('Verified, sign in');
        expect(api.executeConfirmEmailRequest).toHaveBeenCalledWith({
            verificationId: 'link-verification',
            token,
        });
    });

    it('resending switches the code form to the replacement verification id', async () => {
        pending();
        api.executeResendVerificationRequest.mockResolvedValue({
            verification: metadata('verification-2'),
        });
        show();
        fireEvent.click(
            screen.getByRole('button', { name: 'Resend verification email' })
        );
        await screen.findByText(/A new verification email/);
        pasteCode('123456');
        fireEvent.click(screen.getByRole('button', { name: 'Confirm email' }));
        await screen.findByText('Verified, sign in');

        expect(api.executeResendVerificationRequest).toHaveBeenCalledWith(
            'verification-1'
        );
        expect(api.executeConfirmEmailRequest).toHaveBeenCalledWith({
            verificationId: 'verification-2',
            code: '123456',
        });
    });

    it('recovers with credentials without persisting the password', async () => {
        api.executeRecoverVerificationRequest.mockResolvedValue({
            verification: metadata('recovered'),
        });
        show();
        fireEvent.change(screen.getByLabelText('Email or username'), {
            target: { value: 'new@example.com' },
        });
        fireEvent.change(screen.getByLabelText('Password'), {
            target: { value: 'Password123!' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Request verification email' })
        );
        await screen.findByLabelText('Code digit 1');

        expect(api.executeRecoverVerificationRequest).toHaveBeenCalledWith({
            identifier: 'new@example.com',
            password: 'Password123!',
        });
        expect(
            sessionStorage.getItem('mossy.pendingEmailVerification')
        ).not.toContain('Password123!');
    });

    it('blocks expired code submission while allowing resend', () => {
        pending(true);
        show();
        pasteCode('123456');
        expect(
            (
                screen.getByRole('button', {
                    name: 'Confirm email',
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
        expect(
            (
                screen.getByRole('button', {
                    name: 'Resend verification email',
                }) as HTMLButtonElement
            ).disabled
        ).toBe(false);
        expect(
            screen.getByText('Your code has expired. Request a new email.')
        ).toBeTruthy();
    });

    it('shows confirmation failures and does not navigate to login', async () => {
        pending();
        api.executeConfirmEmailRequest.mockRejectedValue(
            new ApiError('Verification unavailable', 503)
        );
        show();
        pasteCode('123456');
        fireEvent.click(screen.getByRole('button', { name: 'Confirm email' }));
        await waitFor(() =>
            expect(screen.getByRole('alert').textContent).toBe(
                'Verification unavailable'
            )
        );
        expect(screen.queryByText('Verified, sign in')).toBeNull();
    });

    it('honors resend Retry-After without discarding the pending request', async () => {
        pending();
        api.executeResendVerificationRequest.mockRejectedValue(
            new ApiError('Please wait', 429, 'RESEND_RATE_LIMITED', 60)
        );
        show();
        fireEvent.click(
            screen.getByRole('button', { name: 'Resend verification email' })
        );
        await screen.findByRole('alert');
        expect(
            (
                screen.getByRole('button', {
                    name: /Resend available in/,
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
        expect(
            sessionStorage.getItem('mossy.pendingEmailVerification')
        ).toContain('verification-1');
    });
});
