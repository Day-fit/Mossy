package pl.dayfit.mossyauth.exception

abstract class EmailVerificationException(
    override val message: String,
    val code: String,
    val retryAfter: Long? = null
) : RuntimeException(message)
