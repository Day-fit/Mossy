import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth.ts';

interface NavTabProps {
	name: string;
	url: string;
	requiresAuthentication: boolean;
	onClick?: () => void;
	badgeCount?: number;
}

const MotionNavLink = motion.create(NavLink);

function NavTab({
	name,
	url,
	requiresAuthentication,
	onClick,
	badgeCount = 0,
}: NavTabProps) {
	const { isAuthenticated } = useAuth();

	return (
		(isAuthenticated === true || !requiresAuthentication) && (
			<section>
				<MotionNavLink
					to={url}
					onClick={onClick}
					className={({ isActive }) =>
						(isActive ? 'font-bold' : 'font-normal') +
						' text-justify text-l z-10 flex items-center justify-center h-full px-5'
					}
				>
					{({ isActive }) => (
						<div className={'flex flex-col'}>
							<span>{name}</span>
							{badgeCount > 0 ? (
								<span className="text-center text-[10px] font-medium leading-3 text-amber-700">
									{badgeCount} pending
								</span>
							) : null}
							{isActive && (
								<motion.div
									className="border-b-2 border-emerald-500"
									initial={{ scaleX: 0 }}
									animate={{ scaleX: 1 }}
									transition={{
										duration: 0.2,
										ease: 'easeOut',
									}}
									style={{ transformOrigin: 'right' }}
								/>
							)}
						</div>
					)}
				</MotionNavLink>
			</section>
		)
	);
}

export default NavTab;
