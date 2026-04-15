package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.response.VaultResponseMessageDto
import messaging.request.PasswordMetadataDto
import messaging.request.type.MetadataRequestType
import messaging.response.type.MetadataResponseType
import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import java.lang.reflect.Type

@Component
class MetadataHandler(
    private val passwordEntryRepository: PasswordEntryRepository,
    private val stompSessionRegistry: StompSessionRegistry
) : StompFrameHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(MetadataHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type {
        return VaultRequestMessageDto::class.java
    }

    @Suppress("UNCHECKED_CAST")
    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val requestDto = payload as? VaultRequestMessageDto<MetadataRequestType>

        if (requestDto == null) {
            logger.warn("Received invalid payload for password query, ignoring it")
            return
        }

        val passwords = passwordEntryRepository.findAll()
        val metadata = passwords.map {
            PasswordMetadataDto(
                passwordId = requireNotNull(it.id) { "Password entry is missing id" },
                identifier = it.identifier,
                domain = it.domain,
                lastModified = it.lastModified
            )
        }

        val response = VaultResponseMessageDto(
            requestDto.messageId,
            MetadataResponseType(metadata),
            VaultResponseStatus.OK
        )

        stompSessionRegistry.send(
            StompEndpoints.USER_PASSWORDS_QUERIED,
            response
        )
    }
}
