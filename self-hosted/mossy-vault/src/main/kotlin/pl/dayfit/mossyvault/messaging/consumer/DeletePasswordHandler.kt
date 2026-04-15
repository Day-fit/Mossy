package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.response.VaultResponseMessageDto
import messaging.request.type.DeletePasswordRequestType
import messaging.response.type.DeletePasswordResponseType
import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.service.PasswordEntryService
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
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
        return VaultRequestMessageDto::class.java
    }

    @Suppress("UNCHECKED_CAST")
    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val requestDto = payload as? VaultRequestMessageDto<DeletePasswordRequestType>

        if (requestDto == null) {
            logger.warn("Received invalid payload, ignoring it")
            return
        }
        val passwordId = requestDto.payload.passwordId

        val passwordEntry = passwordEntryRepository.findById(passwordId)
            .getOrNull()

        if (passwordEntry == null) {
            logger.warn("Password entry not found, id={}, ignoring", passwordId)
            return
        }

        try {
            passwordEntryService.delete(passwordId)

            stompSessionRegistry.send(
                StompEndpoints.USER_PASSWORD_DELETED,
                VaultResponseMessageDto(
                    requestDto.messageId,
                    DeletePasswordResponseType(
                        passwordEntry.domain,
                        passwordId
                    ),
                    VaultResponseStatus.OK
                )
            )
        } catch (_: NoSuchElementException) {
            logger.warn("Password entry not found, id={}, ignoring", passwordId)
            stompSessionRegistry.send(
                StompEndpoints.USER_PASSWORD_DELETED,
                VaultResponseMessageDto(
                    requestDto.messageId,
                    DeletePasswordResponseType(),
                    VaultResponseStatus.NOT_FOUND
                )
            )
        } catch (e: Exception){
            logger.error("Error occurred while deleting password entry, id=$passwordId", e)
            stompSessionRegistry.send(
                StompEndpoints.USER_PASSWORD_DELETED,
                VaultResponseMessageDto(
                    requestDto.messageId,
                    DeletePasswordResponseType(),
                    VaultResponseStatus.ERROR
                )
            )
        }
    }
}
