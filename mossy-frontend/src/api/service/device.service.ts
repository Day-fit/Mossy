import { executeRegisterDeviceRequest } from '../device.api.ts';

let inFlight: Promise<void> | null = null;

export function ensureDeviceRegistered(ctx: {
	deviceId: string | null | undefined;
	setSyncRequired: (value: boolean) => void;
	generateDeviceKeys: () => Promise<{
		Ed25519: { public: string };
		X25519: { public: string };
	}>;
	saveDeviceId: (id: string) => Promise<void> | void;
}) {
	if (ctx.deviceId != null) return Promise.resolve();

	if (inFlight) return inFlight;

	inFlight = (async () => {
		const keys = await ctx.generateDeviceKeys();

		const res = await executeRegisterDeviceRequest(keys.Ed25519.public);

		await ctx.saveDeviceId(res.deviceId);

		ctx.setSyncRequired(res.requiresSync);
	})().finally(() => {
		inFlight = null;
	});

	return inFlight;
}
