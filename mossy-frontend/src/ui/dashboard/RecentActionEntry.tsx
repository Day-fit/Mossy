import { formatDate } from '../../helpers/DateFormatHelper.ts';
import type { ReactNode } from 'react';
import { IoAddCircle, IoRemoveCircle } from 'react-icons/io5';
import { MdChangeCircle } from 'react-icons/md';

type RecentActionElementProps = {
	actionType: 'added' | 'removed' | 'updated';
	date: string;
	domain: string;
};

export default function RecentActionEntry({
	actionType,
	date,
	domain,
}: RecentActionElementProps) {
	const textToIcon = (text: string): ReactNode => {
		switch (text) {
			case 'added':
				return <IoAddCircle className={'text-2xl'} />;
			case 'removed':
				return <IoRemoveCircle className={'text-2xl'} />;
			case 'updated':
				return <MdChangeCircle className={'text-2xl'} />;
		}
	};

	return (
		<div className="flex items-center justify-around w-11/12 bg-gray-200 py-3 px-2 rounded-md">
			<img
				src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
				alt={`${domain} icon`}
				className="w-6 h-6 mr-2"
			/>
			<h2 className="text-lg">{domain}</h2>
			<span className="text-xs text-gray-500 ml-2">
				{formatDate(date)}
			</span>
			{textToIcon(actionType)}
		</div>
	);
}
