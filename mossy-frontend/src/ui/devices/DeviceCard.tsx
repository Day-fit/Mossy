import { motion } from 'framer-motion';
import { useState } from 'react';
import type { DeviceDetails } from '../../api/deviceTrust.api.ts';
import { useDevices } from '../../hooks/useDevices.ts';
import RippleButton from '../layout/RippleButton.tsx';
import ActionModal from '../shared/ActionModal.tsx';
import { DeviceIcon } from './deviceIcon.tsx';

export default function DeviceCard({ device }: { device: DeviceDetails }) {
	const { actionId, blockDevice, unblockDevice } = useDevices();
	const [isConfirming, setIsConfirming] = useState(false);
	const isUpdating = actionId === device.id;
	const action = device.blocked ? unblockDevice : blockDevice;
	const actionLabel = device.blocked ? 'Unblock' : 'Block';

	const confirmAction = async () => {
		if (await action(device.id)) setIsConfirming(false);
	};

	return (
		<>
			<motion.article
				className="rounded-xl border border-gray-200 bg-white p-5 shadow-md"
				initial={{ opacity: 0, y: 18 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3 }}
			>
				<div className="flex items-start gap-4">
					<div className="rounded-lg bg-emerald-50 p-3 text-3xl text-emerald-700">
						<DeviceIcon deviceType={device.deviceType} />
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<h3 className="truncate text-lg font-semibold text-gray-900">
								{device.lastOsName || 'Unknown OS'}
							</h3>
							{device.current ? (
								<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
									Current device
								</span>
							) : null}
						</div>
						<p
							className={`mt-1 text-sm ${device.blocked ? 'text-red-600' : 'text-emerald-700'}`}
						>
							{device.deviceType || 'Unknown device'} ·{' '}
							{device.blocked ? 'Blocked' : 'Active'}
						</p>
					</div>
				</div>

				<dl className="mt-5 space-y-3 text-sm">
					<div>
						<dt className="text-xs font-medium text-gray-500">
							Device ID
						</dt>
						<dd className="mt-1 break-all font-mono text-xs text-gray-700">
							{device.id}
						</dd>
					</div>
					<div>
						<dt className="text-xs font-medium text-gray-500">
							Last seen
						</dt>
						<dd className="text-gray-700">
							{device.lastSeen
								? new Date(device.lastSeen).toLocaleString()
								: 'Never'}
						</dd>
					</div>
				</dl>

				{!device.current ? (
					<RippleButton
						type="button"
						variant={device.blocked ? 'primary' : 'outline'}
						className="mt-5 px-4 py-2 text-sm"
						disabled={actionId !== null}
						onClick={() => setIsConfirming(true)}
					>
						{isUpdating ? 'Updating…' : actionLabel}
					</RippleButton>
				) : null}
			</motion.article>

			{isConfirming ? (
				<ActionModal
					title={`${actionLabel} device`}
					description={
						device.blocked
							? 'This device will be allowed to authenticate again.'
							: 'This device will no longer be allowed to authenticate.'
					}
					confirmLabel={isUpdating ? 'Updating…' : actionLabel}
					confirmDisabled={actionId !== null}
					onClose={() => setIsConfirming(false)}
					onConfirm={() => void confirmAction()}
				/>
			) : null}
		</>
	);
}
