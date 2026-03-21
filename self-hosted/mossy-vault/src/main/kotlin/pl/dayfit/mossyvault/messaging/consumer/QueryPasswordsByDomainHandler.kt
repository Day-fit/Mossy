package pl.dayfit.mossyvault.messaging.consumer

import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.dto.request.QueryPasswordsByDomainRequestDto
import pl.dayfit.mossyvault.dto.response.PasswordMetadataDto
import pl.dayfit.mossyvault.dto.response.PasswordQueryResponseDto
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import java.lang.reflect.Type

@Component
class QueryPasswordsByDomainHandler(
    private val passwordEntryRepository: PasswordEntryRepository,
    private val stompSessionRegistry: StompSessionRegistry
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

        val passwords = if (requestDto.domain == null) {
            passwordEntryRepository.findAll()
        } else {
            passwordEntryRepository.findByDomain(requestDto.domain)
        }
        val metadata = passwords.map {
            PasswordMetadataDto(
                passwordId = requireNotNull(it.id) { "Password entry is missing id" },
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

        stompSessionRegistry.send(
            StompEndpoints.USER_PASSWORDS_QUERIED,
            response
        )
    }
}
