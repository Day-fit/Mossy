import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
DeviceBootstrapProvider,
useDeviceBootstrapContext,
} from './DeviceBootstrapContext.tsx';

type MockAuthState = {
isAuthenticated: boolean | null;
userDetails: {
userId: string;
username: string;
email: string;
grantedAuthorities: string[];
} | null;
login: (token: string) => void;
logout: () => void;
};

const { authStateRef, useDeviceBootstrap } = vi.hoisted(() => ({
authStateRef: {
current: {
isAuthenticated: false,
userDetails: null,
login: vi.fn(),
logout: vi.fn(),
} as MockAuthState,
},
useDeviceBootstrap: vi.fn(),
}));

vi.mock('./AuthContext.tsx', () => ({
useAuth: () => authStateRef.current,
}));

vi.mock('../hooks/useDeviceBootstrap.ts', () => ({
useDeviceBootstrap,
}));

function Consumer() {
const { requiresSync } = useDeviceBootstrapContext();
return <div>{requiresSync ? 'sync-required' : 'sync-not-required'}</div>;
}

describe('DeviceBootstrapContext', () => {
beforeEach(() => {
vi.clearAllMocks();
authStateRef.current = {
isAuthenticated: false,
userDetails: null,
login: vi.fn(),
logout: vi.fn(),
};
useDeviceBootstrap.mockReturnValue({
bootstrapDevice: vi.fn().mockResolvedValue(undefined),
requiresSync: false,
});
});

it('works without provider', () => {
render(<Consumer />);
expect(screen.getByText('sync-not-required')).toBeTruthy();
});

it('bootstraps for authenticated users inside provider', async () => {
const bootstrapDevice = vi.fn().mockResolvedValue(undefined);
authStateRef.current = {
isAuthenticated: true,
userDetails: {
userId: 'user-1',
username: 'user',
email: 'user@example.com',
grantedAuthorities: [],
},
login: vi.fn(),
logout: vi.fn(),
};
useDeviceBootstrap.mockReturnValue({
bootstrapDevice,
requiresSync: true,
});

render(
<DeviceBootstrapProvider>
<Consumer />
</DeviceBootstrapProvider>
);

expect(useDeviceBootstrap).toHaveBeenCalled();
expect(screen.getByText('sync-required')).toBeTruthy();

await waitFor(() => {
expect(bootstrapDevice).toHaveBeenCalledTimes(1);
});
});
});
