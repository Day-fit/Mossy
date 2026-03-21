package pl.dayfit.mossyvault.messaging.consumer

import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.dto.request.GetCiphertextRequestDto
import pl.dayfit.mossyvault.dto.response.CiphertextResponseDto
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import java.lang.reflect.Type
import kotlin.io.encoding.Base64

@Component
class GetCiphertextHandler(
    private val passwordEntryRepository: PasswordEntryRepository,
    private val stompSessionRegistry: StompSessionRegistry,
) : StompFrameHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(GetCiphertextHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type {
        return GetCiphertextRequestDto::class.java
    }

    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val requestDto = payload as? GetCiphertextRequestDto

        if (requestDto == null) {
            logger.warn("Received invalid payload for ciphertext request, ignoring it")
            return
        }

        val passwordOptional = passwordEntryRepository.findById(requestDto.passwordId)
        
        if (passwordOptional.isEmpty) {
            logger.warn("Password entry not found, id={}", requestDto.passwordId)
            return
        }

        val password = passwordOptional.get()
        val ciphertextBase64 = Base64.encode(password.encryptedBlob)

        val response = CiphertextResponseDto(
            passwordId = requestDto.passwordId,
            ciphertext = ciphertextBase64,
            vaultId = requestDto.vaultId
        )

        stompSessionRegistry.send(
            StompEndpoints.USER_CIPHERTEXT_RETRIEVED,
            response
        )
    }
}
