type PasswordMessagesProps = {
	successMessage: string | null;
	errorMessage: string | null;
	className?: string;
};

export default function PasswordMessages({
	successMessage,
	errorMessage,
	className,
}: PasswordMessagesProps) {
	return (
		<div className={className}>
			{successMessage ? (
				<p className="text-sm text-emerald-700">{successMessage}</p>
			) : null}
			{errorMessage ? (
				<p className="text-sm text-red-600">{errorMessage}</p>
			) : null}
		</div>
	);
}
