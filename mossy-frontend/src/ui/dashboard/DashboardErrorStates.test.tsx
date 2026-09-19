import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordChart from './PasswordChart.tsx';
import RecentActionSection from './RecentActionSection.tsx';

vi.mock('recharts', async (importOriginal) => ({
    ...(await importOriginal<typeof import('recharts')>()),
    ResponsiveContainer: () => null,
}));

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-03T12:00:00Z'));
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe.each(['chart', 'actions'] as const)('%s API failure', (kind) => {
    const data = [{ date: '2025-01-01', passwordCount: 2, addedCount: 1 }];
    const actions = [
        {
            date: '2025-01-01',
            domain: 'example.com',
            actionType: 'ADDED' as const,
        },
    ];

    function view(error: string | null, hasData: boolean, onRetry: () => void) {
        const props = {
            error,
            onRetry,
            emptyAction: { label: 'Add a password', onClick: vi.fn() },
        };
        return kind === 'chart' ? (
            <PasswordChart {...props} data={hasData ? data : []} />
        ) : (
            <RecentActionSection {...props} actions={hasData ? actions : []} />
        );
    }

    it.each([false, true])(
        'blurs on failure and recovers (cached data: %s)',
        (hasData) => {
            const onRetry = vi.fn();
            const { container, rerender } = render(
                view('Network error', hasData, onRetry)
            );

            expect(
                container.querySelector('[aria-hidden="true"].blur-xs')
            ).not.toBeNull();
            expect(screen.getByText(/could not be loaded/)).toBeTruthy();
            expect(
                screen.queryByRole('button', { name: 'Add a password' })
            ).toBeNull();
            fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
            expect(onRetry).toHaveBeenCalledOnce();

            rerender(view(null, true, onRetry));
            expect(container.querySelector('.blur-xs')).toBeNull();
            expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
            if (kind === 'chart') {
                expect(
                    (
                        screen.getByRole('button', {
                            name: 'Total',
                        }) as HTMLButtonElement
                    ).disabled
                ).toBe(false);
            } else {
                expect(
                    screen.getByRole('heading', { name: 'example.com' })
                ).toBeTruthy();
            }
        }
    );

    it('keeps the add action for a successful empty response', () => {
        render(view(null, false, vi.fn()));
        expect(
            screen.getByRole('button', { name: 'Add a password' })
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    });
});

it('shows relative action time with the full date in a tooltip', () => {
    const date = '2025-01-01T12:00:00Z';

    render(
        <RecentActionSection
            actions={[
                { date, domain: 'example.com', actionType: 'ADDED' as const },
            ]}
        />
    );

    const timestamp = screen.getByText('2 days ago');
    expect(timestamp.getAttribute('datetime')).toBe(date);
    expect(timestamp.getAttribute('title')).toBe(
        new Date(date).toLocaleString()
    );
});
