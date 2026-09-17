package pl.dayfit.mossyauth.exception

class VerificationResendLimitedException(retryAfter: Long) : EmailVerificationException(
    "Please wait before requesting another email",
    "RESEND_RATE_LIMITED",
    retryAfter
)
