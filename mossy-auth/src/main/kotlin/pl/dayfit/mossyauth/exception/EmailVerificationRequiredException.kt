package pl.dayfit.mossyauth.exception

class EmailVerificationRequiredException : EmailVerificationException(
    "Please verify your email before signing in",
    "EMAIL_VERIFICATION_REQUIRED"
)
