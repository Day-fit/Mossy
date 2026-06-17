package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.response.VaultResponseMessageDto
import messaging.request.type.CiphertextRequestType
import messaging.response.type.CiphertextResponseType
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import kotlin.io.encoding.Base64

@Component
class CiphertextHandler(
    private val passwordEntryRepository: PasswordEntryRepository,
    private val stompSessionRegistry: StompSessionRegistry,
) : AbstractVaultRequestHandler<CiphertextRequestType>(CiphertextRequestType::class) {
    private val logger = org.slf4j.LoggerFactory.getLogger(CiphertextHandler::class.java)

    override fun handle(message: VaultRequestMessageDto<CiphertextRequestType>, headers: StompHeaders) {
        val payload = message.payload
        val passwordId = payload.passwordId

        val passwordOptional = passwordEntryRepository.findById(passwordId)

        if (passwordOptional.isEmpty) {
            logger.warn("Password entry not found, id={}", passwordId)
            return
        }

        val password = passwordOptional.get()
        val ciphertextBase64 = Base64.encode(password.encryptedBlob)

        val response = VaultResponseMessageDto(
            message.messageId,
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

    override fun getDestination(): String {
        return StompEndpoints.SUBSCRIBE_GET_CIPHERTEXT
    }
}
