package pl.dayfit.mossyauth.exception

class VerificationExpiredException : EmailVerificationException(
    "Verification has expired or was replaced. Request a new email",
    "VERIFICATION_EXPIRED"
)
