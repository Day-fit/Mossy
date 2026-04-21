import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeviceSync } from './useDeviceSync.ts';

type MockDeviceKeyState = {
	deviceId: string | null;
	deviceKeys: {
		X25519: { public: string; private: string };
		Ed25519: { public: string; private: string };
	};
};

const { executeInitKeySyncRequest, deviceKeyStateRef } = vi.hoisted(() => ({
	executeInitKeySyncRequest: vi.fn(),
	deviceKeyStateRef: {
		current: {
			deviceId: 'device-1',
			deviceKeys: {
				X25519: { public: 'x', private: 'x-private' },
				Ed25519: { public: 'e', private: 'e-private' },
			},
		} as MockDeviceKeyState,
	},
}));

vi.mock('../api/device.api.ts', () => ({
	executeInitKeySyncRequest,
}));

vi.mock('../context/DeviceKeyContext.tsx', () => ({
	useDeviceKey: () => ({
		deviceId: deviceKeyStateRef.current.deviceId,
		deviceKeys: deviceKeyStateRef.current.deviceKeys,
		saveDeviceId: vi.fn(),
		generateDeviceKeys: vi.fn(),
		dbRef: { current: null },
	}),
}));

function HookConsumer() {
	const { syncCode } = useDeviceSync();
	return <div>{syncCode ?? 'no-code'}</div>;
}

describe('useDeviceSync', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		deviceKeyStateRef.current = {
			deviceId: 'device-1',
			deviceKeys: {
				X25519: { public: 'x', private: 'x-private' },
				Ed25519: { public: 'e', private: 'e-private' },
			},
		};
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


