import EmailConfirmation from '../ui/signup/EmailConfirmation.tsx';

export default function VerifyEmail() {
    return (
        <section className="relative min-h-[90vh] w-full perspective-distant">
            <EmailConfirmation />
        </section>
    );
}
