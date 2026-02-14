package pl.dayfit.mossyauth.controller.advice

import jakarta.validation.ConstraintViolationException
import org.springframework.core.annotation.Order
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.security.access.AccessDeniedException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
import pl.dayfit.mossyauth.dto.response.GenericServerResponseDto
import pl.dayfit.mossyauth.dto.response.ValidationResponseDto

@Order(2)
@RestControllerAdvice
class GlobalControllerAdvice {
    private val logger = org.slf4j.LoggerFactory.getLogger(this::class.java)

    @ExceptionHandler(MethodArgumentTypeMismatchException::class)
    fun handleMethodArgumentTypeMismatchException(): ResponseEntity<GenericServerResponseDto> {
        logger.debug("Handled invalid request parameter")
        return ResponseEntity.badRequest()
            .body(
                GenericServerResponseDto("Invalid request parameter")
            )
    }

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun handleHttpMessageNotReadableException(): ResponseEntity<GenericServerResponseDto> {
        logger.debug("Handled invalid JSON payload")
        return ResponseEntity.badRequest()
            .body(
                GenericServerResponseDto("Invalid JSON payload")
            )
    }

    @ExceptionHandler(ConstraintViolationException::class)
    fun handleConstraintViolationException(exception: ConstraintViolationException): ResponseEntity<ValidationResponseDto>
    {
        logger.debug("Handled constaint validation errors")
        val errors = exception.constraintViolations.map {
            ValidationResponseDto.ValidationResult(
                it.propertyPath.toString(),
                it.message
            )
        }

        return ResponseEntity.badRequest()
            .body(
                ValidationResponseDto(errors)
            )
    }

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleMethodArgumentNotValidException(exception: MethodArgumentNotValidException): ResponseEntity<ValidationResponseDto>
    {
        logger.debug("Handled method arguments errors")
        val errors = exception.bindingResult.fieldErrors.map {
            ValidationResponseDto.ValidationResult(
                it.field,
                it.defaultMessage ?: "Invalid value"
            )
        }

        return ResponseEntity.badRequest()
            .body(
                ValidationResponseDto(errors)
            )
    }

    @ExceptionHandler(AccessDeniedException::class)
    fun handleAccessDeniedException(): ResponseEntity<GenericServerResponseDto> {
        logger.debug("Handled access denied exception")

        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(
                GenericServerResponseDto("Access denied")
            )
    }

    @ExceptionHandler(Exception::class)
    fun handleException(exception: Exception): ResponseEntity<GenericServerResponseDto>
    {
        logger.error("On handled exception occurred: {}", exception.message)

        return ResponseEntity.internalServerError().body(
            GenericServerResponseDto("Internal server error occurred, please try again later")
        )
    }
}