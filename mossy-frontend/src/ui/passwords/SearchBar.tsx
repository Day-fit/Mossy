import { useSearchStore } from '../../store/searchStore.ts';
import * as React from 'react';
import { MdSearch } from 'react-icons/md';

export default function SearchBar() {
	const { setQuery } = useSearchStore();
	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setQuery(e.target.value.trim());
	};
	return (
		<div className="relative w-full">
			<input
				type="text"
				placeholder="Search"
				className="w-full py-2 pr-8 pl-2 border border-green-800 rounded-md"
				onChange={handleChange}
			/>
			<MdSearch className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-800 text-lg pointer-events-none" />
		</div>
	);
}
