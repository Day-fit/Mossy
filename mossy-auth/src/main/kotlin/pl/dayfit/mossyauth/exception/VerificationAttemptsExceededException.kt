package pl.dayfit.mossyauth.exception

class VerificationAttemptsExceededException(retryAfter: Long) : EmailVerificationException(
    "Too many code attempts. Use the email link or request a new email",
    "TOO_MANY_ATTEMPTS",
    retryAfter
)
