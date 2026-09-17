package pl.dayfit.mossyauth.controller

import jakarta.validation.Valid
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossyauth.dto.request.ConfirmEmailRequestDto
import pl.dayfit.mossyauth.dto.request.RecoverVerificationRequestDto
import pl.dayfit.mossyauth.dto.request.ResendVerificationRequestDto
import pl.dayfit.mossyauth.dto.response.EmailVerificationResponseDto
import pl.dayfit.mossyauth.dto.response.GenericServerResponseDto
import pl.dayfit.mossyauth.service.EmailVerificationService

@RestController
@RequestMapping("/user")
class EmailVerificationController(
    private val service: EmailVerificationService
) {
    @PostMapping("/confirm")
    fun confirm(
        @RequestBody @Valid request: ConfirmEmailRequestDto
    ): GenericServerResponseDto {
        service.confirm(request)
        return GenericServerResponseDto("Email confirmed successfully")
    }

    @PostMapping("/verification/resend")
    fun resend(
        @RequestBody request: ResendVerificationRequestDto
    ): EmailVerificationResponseDto {
        return EmailVerificationResponseDto(service.resend(request.verificationId))
    }

    @PostMapping("/verification/recover")
    fun recover(
        @RequestBody @Valid request: RecoverVerificationRequestDto
    ): EmailVerificationResponseDto {
        return EmailVerificationResponseDto(service.recover(request))
    }
}
