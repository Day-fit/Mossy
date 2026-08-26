import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeviceManagementStore } from '../../store/deviceManagementStore.ts';
import DevicesHero from './DevicesHero.tsx';

const api = vi.hoisted(() => ({
	executeApproveEnrollmentRequest: vi.fn(),
	executeBlockDeviceRequest: vi.fn(),
	executeUnblockDeviceRequest: vi.fn(),
	executeGetDevicesRequest: vi.fn(),
	executeGetEnrollmentsRequest: vi.fn(),
}));

vi.mock('../../api/deviceTrust.api.ts', () => api);

const currentDevice = {
	id: 'current-device',
	lastOsName: 'Linux',
	deviceType: 'Desktop',
	lastSeen: '2026-08-11T12:00:00Z',
	blocked: false,
	current: true,
};
const otherDevice = {
	id: 'other-device',
	lastOsName: 'Android',
	deviceType: 'Phone',
	lastSeen: null,
	blocked: false,
	current: false,
};
const enrollment = {
	id: 'enrollment-1',
	lastOsName: 'iOS',
	deviceType: 'Tablet',
	remoteAddr: '192.0.2.10',
	createdAt: '2026-08-11T13:00:00Z',
};

describe('DevicesHero', () => {
	afterEach(cleanup);

	beforeEach(() => {
		vi.clearAllMocks();
		useDeviceManagementStore.getState().clear();
		useDeviceManagementStore
			.getState()
			.setDevices([currentDevice, otherDevice]);
		useDeviceManagementStore.getState().setEnrollments([enrollment]);
		api.executeApproveEnrollmentRequest.mockResolvedValue(undefined);
		api.executeBlockDeviceRequest.mockResolvedValue(undefined);
		api.executeUnblockDeviceRequest.mockResolvedValue(undefined);
		api.executeGetDevicesRequest.mockResolvedValue([
			currentDevice,
			otherDevice,
		]);
		api.executeGetEnrollmentsRequest.mockResolvedValue([]);
	});

	it('approves a pending enrollment and refreshes shared device state', async () => {
		render(<DevicesHero />);

		expect(screen.getByText('192.0.2.10')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

		await waitFor(() => {
			expect(api.executeApproveEnrollmentRequest).toHaveBeenCalledWith(
				'enrollment-1'
			);
			expect(screen.queryByText('192.0.2.10')).toBeNull();
		});
		expect(useDeviceManagementStore.getState().enrollments).toEqual([]);
	});

	it('requires confirmation before blocking a non-current device', async () => {
		render(<DevicesHero />);

		fireEvent.click(screen.getByRole('button', { name: 'Block' }));
		expect(api.executeBlockDeviceRequest).not.toHaveBeenCalled();

		const dialog = screen.getByRole('dialog', { name: 'Block device' });
		fireEvent.click(within(dialog).getByRole('button', { name: 'Block' }));

		await waitFor(() => {
			expect(api.executeBlockDeviceRequest).toHaveBeenCalledWith(
				'other-device'
			);
		});
	});
});
