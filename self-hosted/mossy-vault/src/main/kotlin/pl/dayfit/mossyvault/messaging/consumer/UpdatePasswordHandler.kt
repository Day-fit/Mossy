package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.request.type.UpdatePasswordRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.UpdatePasswordResponseType
import org.slf4j.LoggerFactory
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.service.PasswordEntryService
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import kotlin.io.encoding.Base64

@Component
class UpdatePasswordHandler(
    private val persistenceService: PasswordEntryService,
    private val stompSessionRegistry: StompSessionRegistry
) : AbstractVaultRequestHandler<UpdatePasswordRequestType>(UpdatePasswordRequestType::class) {
    private val logger = LoggerFactory.getLogger(UpdatePasswordHandler::class.java)

    override fun handle(message: VaultRequestMessageDto<UpdatePasswordRequestType>, headers: StompHeaders) {
        val payload = message.payload
        val messageId = message.messageId

        try {
            val passwordId = persistenceService.update(payload, Base64.decode(payload.cipherText))

            stompSessionRegistry.send(
                StompEndpoints.USER_PASSWORD_UPDATED,
                VaultResponseMessageDto(
                    messageId,
                    UpdatePasswordResponseType(
                        passwordId,
                        payload.address
                    ),
                    VaultResponseStatus.OK
                )
            )
        } catch (e: Exception) {
            logger.error("Failed to update password entry: ${payload.passwordId}", e)
            stompSessionRegistry.send(
                StompEndpoints.USER_PASSWORD_UPDATED,
                VaultResponseMessageDto(
                    messageId,
                    UpdatePasswordResponseType(),
                    VaultResponseStatus.ERROR
                )
            )
            return
        }
    }

    override fun getDestination(): String {
        return StompEndpoints.SUBSCRIBE_UPDATE_PASSWORD
    }
}
