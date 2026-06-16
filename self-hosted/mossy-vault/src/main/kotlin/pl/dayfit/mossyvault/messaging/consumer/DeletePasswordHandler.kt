package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.response.VaultResponseMessageDto
import messaging.request.type.DeletePasswordRequestType
import messaging.response.type.DeletePasswordResponseType
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.service.PasswordEntryService
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import kotlin.jvm.optionals.getOrNull

@Component
class DeletePasswordHandler(
    private val passwordEntryService: PasswordEntryService,
    private val stompSessionRegistry: StompSessionRegistry,
    private val passwordEntryRepository: PasswordEntryRepository
) : AbstractVaultRequestHandler<DeletePasswordRequestType>(DeletePasswordRequestType::class) {
    private val logger = org.slf4j.LoggerFactory.getLogger(DeletePasswordHandler::class.java)

    override fun handle(message: VaultRequestMessageDto<DeletePasswordRequestType>, headers: StompHeaders) {
        val payload = message.payload
        val passwordId = payload.passwordId

        val passwordEntry = passwordEntryRepository.findById(passwordId)
            .getOrNull()

        if (passwordEntry == null) {
            logger.warn("Password entry not found, id={}, ignoring", passwordId)
            return
        }

        val messageId = message.messageId

        try {
            passwordEntryService.delete(passwordId)

            stompSessionRegistry.send(
                StompEndpoints.USER_PASSWORD_DELETED,
                VaultResponseMessageDto(
                    messageId,
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
                    messageId,
                    DeletePasswordResponseType(),
                    VaultResponseStatus.NOT_FOUND
                )
            )
        } catch (e: Exception){
            logger.error("Error occurred while deleting password entry, id=$passwordId", e)
            stompSessionRegistry.send(
                StompEndpoints.USER_PASSWORD_DELETED,
                VaultResponseMessageDto(
                    messageId,
                    DeletePasswordResponseType(),
                    VaultResponseStatus.ERROR
                )
            )
        }
    }

    override fun getDestination(): String {
        return StompEndpoints.SUBSCRIBE_DELETE_PASSWORD
    }
}
