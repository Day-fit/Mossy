import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Button from './Button';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

it('cancels every pending ripple timer when unmounted', () => {
    vi.useFakeTimers();
    const setTimeout = vi.spyOn(window, 'setTimeout');
    const clearTimeout = vi.spyOn(window, 'clearTimeout');
    const { unmount } = render(<Button>Continue</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    vi.setSystemTime(Date.now() + 1);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const rippleTimers = setTimeout.mock.calls.flatMap((call, index) =>
        call[1] === 600 ? [setTimeout.mock.results[index].value] : []
    );
    expect(rippleTimers).toHaveLength(2);

    unmount();

    for (const timer of rippleTimers) {
        expect(clearTimeout).toHaveBeenCalledWith(timer);
    }
});
