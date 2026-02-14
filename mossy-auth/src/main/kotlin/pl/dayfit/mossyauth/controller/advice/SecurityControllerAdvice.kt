package pl.dayfit.mossyauth.controller.advice

import org.springframework.core.annotation.Order
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import pl.dayfit.mossyauth.dto.response.GenericServerResponseDto
import pl.dayfit.mossyauth.exception.SigningKeyNotInitializedException
import pl.dayfit.mossyauth.exception.UserAlreadyExistsException

@Order(1)
@RestControllerAdvice
class SecurityControllerAdvice {
    private val logger = org.slf4j.LoggerFactory.getLogger(this::class.java)

    @ExceptionHandler(UserAlreadyExistsException::class)
    fun handleUserAlreadyExistException(): ResponseEntity<GenericServerResponseDto> {
        logger.debug("Handled user already exist")

        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(
                GenericServerResponseDto("User already exists")
            )
    }

    @ExceptionHandler(BadCredentialsException::class)
    fun handleBadCredentialsException(): ResponseEntity<GenericServerResponseDto> {
        logger.debug("Handled bad credentials")

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(
                GenericServerResponseDto("Bad credentials")
            )
    }

    @ExceptionHandler(SigningKeyNotInitializedException::class)
    fun handleSigningKeyUninitializedException(): ResponseEntity<GenericServerResponseDto> {
        logger.error("Signing key is not initialized")

        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(
                GenericServerResponseDto("Signing key is not initialized")
            )
    }
}