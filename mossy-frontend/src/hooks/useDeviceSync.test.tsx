import { useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('./useDeviceKeys.ts', () => ({
	useDeviceKeys: () => ({
		generateDhKey: vi.fn(),
		idKey: null,
	}),
}));

vi.mock('./useEncryptionHook.ts', () => ({
	useEncryptionHook: () => ({
		loadKey: vi.fn(),
		saveRawKey: vi.fn(),
	}),
}));

function HookConsumer() {
	const { initializeKeySync } = useDeviceSync();
	const [code, setCode] = useState<string | null>(null);

	const handleInit = async () => {
		try {
			setCode(await initializeKeySync('vault-1'));
		} catch {
			setCode(null);
		}
	};

	return (
		<div>
			<button onClick={() => void handleInit()}>init</button>
			<div>{code ?? 'no-code'}</div>
		</div>
	);
}

describe('useDeviceSync', () => {
	afterEach(() => {
		cleanup();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		deviceKeyStateRef.current = { deviceId: 'device-1' };
		executeInitKeySyncRequest.mockResolvedValue({ code: 'ABC123' });
	});

	it('initializes key sync when deviceId is present', async () => {
		render(<HookConsumer />);
		screen.getByText('init').click();

		await waitFor(() => {
			expect(executeInitKeySyncRequest).toHaveBeenCalledWith(
				'device-1',
				'vault-1'
			);
		});

		expect(screen.getByText('ABC123')).toBeTruthy();
	});

	it('does not initialize key sync when deviceId is missing', async () => {
		deviceKeyStateRef.current.deviceId = null;

		render(<HookConsumer />);
		screen.getByText('init').click();

		await waitFor(() => {
			expect(screen.getByText('no-code')).toBeTruthy();
		});
		expect(executeInitKeySyncRequest).not.toHaveBeenCalled();
	});
});
