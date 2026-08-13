package pl.dayfit.mossydevicetrust.controller.advice

import org.springframework.core.annotation.Order
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import pl.dayfit.mossydevicetrust.controller.InternalNonceChallengeController
import pl.dayfit.mossydevicetrustshared.dto.response.ForwardedErrorResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.InternalResponseDto

@Order(1)
@RestControllerAdvice(assignableTypes = [InternalNonceChallengeController::class])
class InternalControllerAdvice {
    @ExceptionHandler(NoSuchElementException::class)
    fun handleNoSuchElementException(exception: NoSuchElementException): ResponseEntity<InternalResponseDto<Nothing>> {
        return ResponseEntity.ok(
            InternalResponseDto(
                forwardedError = ForwardedErrorResponseDto(
                    forwardedMessage = exception.message ?: "Resource not found",
                    forwardedStatusCode = HttpStatus.NOT_FOUND.value(),
                )
            )
        )
    }
}
