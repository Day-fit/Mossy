export type DeviceIconKind =
	| 'desktop'
	| 'laptop'
	| 'phone'
	| 'tablet'
	| 'watch'
	| 'tv'
	| 'console'
	| 'server'
	| 'network'
	| 'bot'
	| 'other';

export function getDeviceIconKind(deviceType: string): DeviceIconKind {
	const normalized = deviceType.trim().toLowerCase();

	if (/phone|mobile/.test(normalized)) return 'phone';
	if (/tablet/.test(normalized)) return 'tablet';
	if (/watch|wearable/.test(normalized)) return 'watch';
	if (/game|console/.test(normalized)) return 'console';
	if (/television|\btv\b|set.?top|media player/.test(normalized)) return 'tv';
	if (/laptop|notebook/.test(normalized)) return 'laptop';
	if (/desktop|workstation/.test(normalized)) return 'desktop';
	if (/server|cloud/.test(normalized)) return 'server';
	if (/router|network/.test(normalized)) return 'network';
	if (/robot|bot|crawler|spider/.test(normalized)) return 'bot';

	return 'other';
}
