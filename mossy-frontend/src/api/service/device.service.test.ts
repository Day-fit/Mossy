import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureDeviceRegistered } from './device.service.ts';

const { executeRegisterDeviceRequest } = vi.hoisted(() => ({
	executeRegisterDeviceRequest: vi.fn(),
}));

vi.mock('../device.api.ts', () => ({
	executeRegisterDeviceRequest,
}));

describe('ensureDeviceRegistered', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		executeRegisterDeviceRequest.mockResolvedValue({
			deviceId: 'device-100',
			requiresSync: true,
		});
	});

	it('registers device when deviceId is undefined', async () => {
		const generateDeviceKeys = vi.fn().mockResolvedValue({
			Ed25519: { public: 'ed' },
			X25519: { public: 'x' },
		});
		const saveDeviceId = vi.fn();
		const setSyncRequired = vi.fn();

		await ensureDeviceRegistered({
			deviceId: undefined,
			generateDeviceKeys,
			saveDeviceId,
			setSyncRequired,
		});

		expect(generateDeviceKeys).toHaveBeenCalledTimes(1);
		expect(executeRegisterDeviceRequest).toHaveBeenCalledWith('ed', 'x');
		expect(saveDeviceId).toHaveBeenCalledWith('device-100');
		expect(setSyncRequired).toHaveBeenCalledWith(true);
	});

	it('skips registration when deviceId exists', async () => {
		const generateDeviceKeys = vi.fn();
		const saveDeviceId = vi.fn();
		const setSyncRequired = vi.fn();

		await ensureDeviceRegistered({
			deviceId: 'device-existing',
			generateDeviceKeys,
			saveDeviceId,
			setSyncRequired,
		});

		expect(generateDeviceKeys).not.toHaveBeenCalled();
		expect(executeRegisterDeviceRequest).not.toHaveBeenCalled();
		expect(saveDeviceId).not.toHaveBeenCalled();
		expect(setSyncRequired).not.toHaveBeenCalled();
	});
});

