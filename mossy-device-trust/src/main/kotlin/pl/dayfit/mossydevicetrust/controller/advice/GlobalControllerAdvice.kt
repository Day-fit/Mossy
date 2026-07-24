package pl.dayfit.mossydevicetrust.controller.advice

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.LockedException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import pl.dayfit.mossydevicetrust.dto.response.GenericServerResponseDto
import pl.dayfit.mossydevicetrust.dto.response.ValidationResponseDto
import pl.dayfit.mossydevicetrust.exception.SelfLockNotAllowedException

@RestControllerAdvice
class GlobalControllerAdvice {
    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleMethodArgumentNotValidException(exception: MethodArgumentNotValidException): ResponseEntity<ValidationResponseDto> {
        val errors = exception.bindingResult.fieldErrors.map {
            ValidationResponseDto.ValidationResult(
                it.field,
                it.defaultMessage ?: "Invalid value"
            )
        }

        return ResponseEntity.badRequest()
            .body(ValidationResponseDto(errors))
    }

    @ExceptionHandler(SelfLockNotAllowedException::class)
    fun handleSelfLockNotAllowedException(exception: SelfLockNotAllowedException): ResponseEntity<GenericServerResponseDto> {
        return ResponseEntity.badRequest()
            .body(GenericServerResponseDto(exception.message ?: "Device cannot be blocked by itself"))
    }

    @ExceptionHandler(AccessDeniedException::class)
    fun handleAccessDeniedException(exception: AccessDeniedException): ResponseEntity<GenericServerResponseDto> {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(GenericServerResponseDto(exception.message ?: "Access denied"))
    }

    @ExceptionHandler(LockedException::class)
    fun handleLockedException(exception: LockedException): ResponseEntity<GenericServerResponseDto> {
        return ResponseEntity.status(HttpStatus.LOCKED)
            .body(GenericServerResponseDto(exception.message ?: "Resource is locked"))
    }

    @ExceptionHandler(NoSuchElementException::class)
    fun handleNoSuchElementException(exception: NoSuchElementException): ResponseEntity<GenericServerResponseDto> {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(GenericServerResponseDto(exception.message ?: "Resource not found"))
    }
}
