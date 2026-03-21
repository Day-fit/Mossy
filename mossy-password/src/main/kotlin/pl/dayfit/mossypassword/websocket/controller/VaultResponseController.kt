package pl.dayfit.mossypassword.websocket.controller

import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.stereotype.Controller
import pl.dayfit.mossypassword.dto.response.CiphertextResponseDto
import pl.dayfit.mossypassword.dto.response.PasswordQueryResponseDto
import pl.dayfit.mossypassword.service.PasswordQueryService

@Controller
class VaultResponseController(
    private val passwordQueryService: PasswordQueryService
) {
    @MessageMapping("/vault/passwords-queried")
    fun handleResponse(response: PasswordQueryResponseDto) {
        passwordQueryService.handlePasswordQueryResponse(response)
    }

    @MessageMapping("/vault/ciphertext-retrieved")
    fun handleCiphertextResponse(response: CiphertextResponseDto) {
        passwordQueryService.handleCiphertextResponse(response)
    }
}