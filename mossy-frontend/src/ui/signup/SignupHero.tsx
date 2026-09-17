import { useState } from 'react';
import ResponseToast from '../layout/ResponseToast.tsx';
import SignupForm from './SignupForm.tsx';
import { useNavigate } from 'react-router-dom';

export default function SignupHero() {
    const navigate = useNavigate();

    const [responseState, setResponseState] = useState<{
        message: string;
        isError?: boolean;
    }>({
        message: '',
        isError: undefined,
    });

    return (
        <section className="relative min-h-[90vh] w-full perspective-distant">
            <ResponseToast
                setResponseState={setResponseState}
                message={responseState.message}
                isError={responseState.isError}
                className="absolute top-10 right-5 max-w-[calc(100vw-2rem)] sm:max-w-md z-10"
            ></ResponseToast>

            <SignupForm
                setResponseState={setResponseState}
                onSuccess={() => navigate('/dashboard')}
            />
        </section>
    );
}
