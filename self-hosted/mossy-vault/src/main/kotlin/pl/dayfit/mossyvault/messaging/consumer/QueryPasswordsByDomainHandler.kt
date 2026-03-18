package pl.dayfit.mossyvault.messaging.consumer

import org.springframework.beans.factory.ObjectProvider
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.dto.request.QueryPasswordsByDomainRequestDto
import pl.dayfit.mossyvault.dto.response.PasswordMetadataDto
import pl.dayfit.mossyvault.dto.response.PasswordQueryResponseDto
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import java.lang.reflect.Type

@Component
class QueryPasswordsByDomainHandler(
    private val passwordEntryRepository: PasswordEntryRepository,
    private val messagingTemplateProvider: ObjectProvider<SimpMessagingTemplate>
) : StompFrameHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(QueryPasswordsByDomainHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type {
        return QueryPasswordsByDomainRequestDto::class.java
    }

    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val requestDto = payload as? QueryPasswordsByDomainRequestDto

        if (requestDto == null) {
            logger.warn("Received invalid payload for password query, ignoring it")
            return
        }

        val passwords = if (requestDto.domain.isNullOrBlank()) {
            passwordEntryRepository.findAll()
        } else {
            passwordEntryRepository.findByDomain(requestDto.domain)
        }
        val metadata = passwords.map {
            PasswordMetadataDto(
                passwordId = it.id!!,
                identifier = it.identifier,
                domain = it.domain,
                lastModified = it.lastModified
            )
        }

        val response = PasswordQueryResponseDto(
            passwords = metadata,
            domain = requestDto.domain,
            vaultId = requestDto.vaultId
        )

        // Send response back to the vault
        val messagingTemplate = messagingTemplateProvider.getIfAvailable()
        if (messagingTemplate == null) {
            logger.warn("SimpMessagingTemplate bean is not available, skipping passwords-queried response for vault {}", requestDto.vaultId)
            return
        }

        messagingTemplate.convertAndSendToUser(
            requestDto.vaultId.toString(),
            "/vault/passwords-queried",
            response
        )
    }
}
