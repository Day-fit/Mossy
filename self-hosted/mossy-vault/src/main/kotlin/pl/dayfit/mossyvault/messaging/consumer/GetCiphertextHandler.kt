package pl.dayfit.mossyvault.messaging.consumer

import org.springframework.beans.factory.ObjectProvider
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.dto.request.GetCiphertextRequestDto
import pl.dayfit.mossyvault.dto.response.CiphertextResponseDto
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import java.lang.reflect.Type
import kotlin.io.encoding.Base64

@Component
class GetCiphertextHandler(
    private val passwordEntryRepository: PasswordEntryRepository,
    private val messagingTemplateProvider: ObjectProvider<SimpMessagingTemplate>
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

        // Send response back to the vault
        val messagingTemplate = messagingTemplateProvider.getIfAvailable()
        if (messagingTemplate == null) {
            logger.warn("SimpMessagingTemplate bean is not available, skipping ciphertext-retrieved response for vault {}", requestDto.vaultId)
            return
        }

        messagingTemplate.convertAndSendToUser(
            requestDto.vaultId.toString(),
            "/vault/ciphertext-retrieved",
            response
        )
    }
}
