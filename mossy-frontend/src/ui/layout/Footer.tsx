import { NavLink } from 'react-router-dom';

export default function Footer() {
	return (
		<footer className="flex border-t-2 border-gray-200 justify-around bg-white p-5">
			<section className="flex flex-col">
				<h3 className="text-xl mb-1">Repository, bugs, ideas</h3>
				<a
					target="_blank"
					href="https://github.com/Day-fit/Mossy"
					rel="noopener noreferrer"
					className="text-gray-600"
				>
					Repository
				</a>
				<a
					target="_blank"
					href="https://github.com/Day-fit/Mossy/issues/new"
					rel="noopener noreferrer"
					className="text-gray-600"
				>
					Report a bug
				</a>
				<a
					target="_blank"
					href="https://github.com/Day-fit/Mossy/issues/new"
					rel="noopener noreferrer"
					className="text-gray-600"
				>
					Share your idea
				</a>
			</section>
			<section className="flex flex-col">
				<h3 className="text-xl mb-1">Site map</h3>
				<NavLink to="/" className="text-gray-600">
					Home
				</NavLink>
				<NavLink to="/register" className="text-gray-600">
					Sign up
				</NavLink>
				<NavLink to="/login" className="text-gray-600">
					Sign in
				</NavLink>
				<NavLink to="/dashboard" className="text-gray-600">
					Dashboard
				</NavLink>
				<NavLink to="/passwords" className="text-gray-600">
					Passwords
				</NavLink>
			</section>
		</footer>
	);
}
