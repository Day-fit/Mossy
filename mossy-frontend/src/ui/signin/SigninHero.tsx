import { useState } from 'react';
import ResponseToast from '../layout/ResponseToast.tsx';
import SigninForm from './SigninForm.tsx';
import { useLocation, useNavigate } from 'react-router-dom';

export default function SigninHero() {
    const location = useLocation();
    const [responseState, setResponseState] = useState<{
        message: string;
        isError?: boolean;
    }>({
        message: location.state?.emailVerified
            ? 'Email confirmed successfully! You can now sign in.'
            : '',
        isError: undefined,
    });
    const navigate = useNavigate();

    return (
        <section className="relative min-h-[90vh] w-full perspective-distant">
            <ResponseToast
                setResponseState={setResponseState}
                message={responseState.message}
                isError={responseState.isError}
                className="absolute top-10 right-5 max-w-[calc(100vw-2rem)] sm:max-w-md z-10"
            ></ResponseToast>

            <SigninForm
                setResponseState={setResponseState}
                onSuccess={() => navigate('/dashboard')}
            />
        </section>
    );
}
