package pl.dayfit.mossyvault.messaging.consumer

import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossyvault.dto.response.DeletePasswordVaultResponseDto
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.service.PasswordEntryService
import pl.dayfit.mossyvault.service.StompSessionRegistry
import java.lang.reflect.Type
import kotlin.jvm.optionals.getOrNull

@Component
class DeletePasswordHandler(
    private val passwordEntryService: PasswordEntryService,
    private val stompSessionRegistry: StompSessionRegistry,
    private val passwordEntryRepository: PasswordEntryRepository
) : StompFrameHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(DeletePasswordHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type {
        return DeletePasswordRequestDto::class.java
    }

    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val requestDto = payload as? DeletePasswordRequestDto

        if (requestDto == null) {
            logger.warn("Received invalid payload, ignoring it")
            return
        }

        val passwordEntry = passwordEntryRepository.findById(requestDto.passwordId)
            .getOrNull()

        if (passwordEntry == null) {
            logger.warn("Password entry not found, id={}, ignoring", requestDto.passwordId)
            return
        }

        passwordEntryService.delete(requestDto)

        stompSessionRegistry.send(
            StompEndpoints.USER_PASSWORD_DELETED,
            DeletePasswordVaultResponseDto(
                passwordEntry.domain,
                passwordEntry.id!!
            )
        )
    }
}
