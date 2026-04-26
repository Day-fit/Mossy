import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeviceSync } from './useDeviceSync.ts';

const { executeInitKeySyncRequest, deviceKeyStateRef } = vi.hoisted(() => ({
	executeInitKeySyncRequest: vi.fn(),
	deviceKeyStateRef: {
		current: {
			deviceId: 'device-1' as string | null,
		},
	},
}));

vi.mock('../api/device.api.ts', () => ({
	executeInitKeySyncRequest,
}));

vi.mock('../store/deviceStore.ts', () => ({
	useDeviceStore: (selector: (state: { deviceId: string | null }) => unknown) =>
		selector({ deviceId: deviceKeyStateRef.current.deviceId }),
}));

function HookConsumer() {
	const { syncCode } = useDeviceSync();
	return <div>{syncCode ?? 'no-code'}</div>;
}

describe('useDeviceSync', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		deviceKeyStateRef.current = { deviceId: 'device-1' };
		executeInitKeySyncRequest.mockResolvedValue({ code: 'ABC123' });
	});

	it('initializes key sync when deviceId is present', async () => {
		render(<HookConsumer />);

		await waitFor(() => {
			expect(executeInitKeySyncRequest).toHaveBeenCalledWith('device-1');
		});

		expect(screen.getByText('ABC123')).toBeTruthy();
	});

	it('does not initialize key sync when deviceId is missing', async () => {
		deviceKeyStateRef.current.deviceId = null;

		render(<HookConsumer />);

		await waitFor(() => {
			expect(screen.getByText('no-code')).toBeTruthy();
		});
		expect(executeInitKeySyncRequest).not.toHaveBeenCalled();
	});
});
