import type { IconType } from 'react-icons';
import {
	MdComputer,
	MdDevicesOther,
	MdDns,
	MdLaptop,
	MdRouter,
	MdSmartToy,
	MdSmartphone,
	MdSportsEsports,
	MdTabletMac,
	MdTv,
	MdWatch,
} from 'react-icons/md';
import {
	getDeviceIconKind,
	type DeviceIconKind,
} from './deviceIconKind.ts';

const iconByKind: Record<DeviceIconKind, IconType> = {
	desktop: MdComputer,
	laptop: MdLaptop,
	phone: MdSmartphone,
	tablet: MdTabletMac,
	watch: MdWatch,
	tv: MdTv,
	console: MdSportsEsports,
	server: MdDns,
	network: MdRouter,
	bot: MdSmartToy,
	other: MdDevicesOther,
};

export function DeviceIcon({ deviceType }: { deviceType: string }) {
	const kind = getDeviceIconKind(deviceType);
	const Icon = iconByKind[kind];

	return (
		<span
			className="inline-flex"
			role="img"
			aria-label={`${deviceType || 'Unknown'} device`}
			data-device-icon={kind}
		>
			<Icon aria-hidden="true" />
		</span>
	);
}
