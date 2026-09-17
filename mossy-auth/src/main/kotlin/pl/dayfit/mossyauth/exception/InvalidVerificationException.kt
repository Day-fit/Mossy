package pl.dayfit.mossyauth.exception

class InvalidVerificationException : EmailVerificationException(
    "Invalid verification code or token",
    "INVALID_VERIFICATION"
)
