import { describe, expect, it } from 'vitest';
import { getDeviceIconKind } from './deviceIconKind.ts';

describe('getDeviceIconKind', () => {
	it.each([
		['Desktop', 'desktop'],
		['Laptop', 'laptop'],
		['Mobile Phone', 'phone'],
		['Tablet', 'tablet'],
		['Smart Watch', 'watch'],
		['Smart TV', 'tv'],
		['Game Console', 'console'],
		['Cloud Server', 'server'],
		['Network Appliance', 'network'],
		['Robot', 'bot'],
		['Unknown', 'other'],
	] as const)('maps %s to the %s icon', (deviceType, expectedKind) => {
		expect(getDeviceIconKind(deviceType)).toBe(expectedKind);
	});
});
