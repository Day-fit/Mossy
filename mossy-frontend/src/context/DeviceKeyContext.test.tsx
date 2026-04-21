import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeviceKeyProvider } from './DeviceKeyContext.tsx';

const { useDeviceKeys } = vi.hoisted(() => ({
	useDeviceKeys: vi.fn(() => ({
		deviceId: null,
		deviceKeys: null,
		saveDeviceId: vi.fn(),
		generateDeviceKeys: vi.fn(),
		dbRef: { current: null },
	})),
}));

vi.mock('../hooks/useDeviceKeys.ts', () => ({
	useDeviceKeys,
}));

vi.mock('./AuthContext.tsx', () => ({
	useAuth: () => ({
		isAuthenticated: true,
		userDetails: {
			userId: 'user-42',
			username: 'alice',
			email: 'alice@example.com',
			grantedAuthorities: [],
		},
		login: vi.fn(),
		logout: vi.fn(),
	}),
}));

describe('DeviceKeyProvider', () => {
	it('passes current auth userId into useDeviceKeys', () => {
		render(
			<DeviceKeyProvider>
				<div>device-key-provider</div>
			</DeviceKeyProvider>
		);

		expect(useDeviceKeys).toHaveBeenCalledWith('user-42');
		expect(screen.getByText('device-key-provider')).toBeTruthy();
	});
});

