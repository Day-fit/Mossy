package pl.dayfit.mossyauth.controller.advice

import org.springframework.core.annotation.Order
import org.springframework.data.redis.RedisConnectionFailureException
import org.springframework.data.redis.RedisSystemException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import pl.dayfit.mossyauth.dto.response.VerificationErrorResponseDto
import pl.dayfit.mossyauth.exception.EmailVerificationException
import pl.dayfit.mossyauth.exception.InvalidVerificationException
import pl.dayfit.mossyauth.exception.VerificationExpiredException
import pl.dayfit.mossyauth.exception.VerificationAttemptsExceededException
import pl.dayfit.mossyauth.exception.VerificationResendLimitedException
import pl.dayfit.mossyauth.exception.EmailVerificationRequiredException

@Order(0)
@RestControllerAdvice
class EmailVerificationControllerAdvice {
    @ExceptionHandler(InvalidVerificationException::class)
    fun invalid(exception: InvalidVerificationException): ResponseEntity<VerificationErrorResponseDto> {
        return response(HttpStatus.BAD_REQUEST, exception)
    }

    @ExceptionHandler(VerificationExpiredException::class)
    fun expired(exception: VerificationExpiredException): ResponseEntity<VerificationErrorResponseDto> {
        return response(HttpStatus.GONE, exception)
    }

    @ExceptionHandler(VerificationAttemptsExceededException::class, VerificationResendLimitedException::class)
    fun limited(exception: EmailVerificationException): ResponseEntity<VerificationErrorResponseDto> {
        return response(HttpStatus.TOO_MANY_REQUESTS, exception)
    }

    @ExceptionHandler(EmailVerificationRequiredException::class)
    fun required(exception: EmailVerificationRequiredException): ResponseEntity<VerificationErrorResponseDto> {
        return response(HttpStatus.FORBIDDEN, exception)
    }

    private fun response(
        status: HttpStatus,
        exception: EmailVerificationException
    ): ResponseEntity<VerificationErrorResponseDto> {
        val response = ResponseEntity.status(status)
        exception.retryAfter?.let {
            response.header("Retry-After", it.toString())
        }

        return response.body(
            VerificationErrorResponseDto(exception.message, exception.code)
        )
    }

    @ExceptionHandler(RedisConnectionFailureException::class, RedisSystemException::class)
    fun unavailable(): ResponseEntity<VerificationErrorResponseDto> {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(
            VerificationErrorResponseDto(
                "Verification is unavailable, please try again later",
                "VERIFICATION_UNAVAILABLE"
            )
        )
    }
}
