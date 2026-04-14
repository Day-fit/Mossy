package pl.dayfit.mossyvault.messaging.consumer

import messaging.VaultRequestMessageDto
import messaging.VaultResponseMessageDto
import messaging.request.type.CiphertextRequestType
import messaging.response.type.CiphertextResponseType
import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import java.lang.reflect.Type
import kotlin.io.encoding.Base64

@Component
class CiphertextHandler(
    private val passwordEntryRepository: PasswordEntryRepository,
    private val stompSessionRegistry: StompSessionRegistry,
) : StompFrameHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(CiphertextHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type {
        return VaultRequestMessageDto::class.java
    }

    @Suppress("UNCHECKED_CAST")
    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val requestDto = payload as? VaultRequestMessageDto<CiphertextRequestType>

        if (requestDto == null) {
            logger.warn("Received invalid payload for ciphertext request, ignoring it")
            return
        }
        val passwordId = requestDto.payload.passwordId

        val passwordOptional = passwordEntryRepository.findById(passwordId)

        if (passwordOptional.isEmpty) {
            logger.warn("Password entry not found, id={}", passwordId)
            return
        }

        val password = passwordOptional.get()
        val ciphertextBase64 = Base64.encode(password.encryptedBlob)

        val response = VaultResponseMessageDto(
            requestDto.messageId,
            CiphertextResponseType(
                ciphertextBase64,
                passwordId
            ),
            VaultResponseStatus.OK
        )

        stompSessionRegistry.send(
            StompEndpoints.USER_CIPHERTEXT_RETRIEVED,
            response
        )
    }
}
