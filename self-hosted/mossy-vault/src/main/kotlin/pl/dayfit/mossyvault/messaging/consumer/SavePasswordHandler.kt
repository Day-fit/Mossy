package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.response.VaultResponseMessageDto
import messaging.request.type.SavePasswordRequestType
import messaging.response.type.SavePasswordResponseType
import org.slf4j.LoggerFactory
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.service.PasswordEntryService
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import kotlin.io.encoding.Base64

@Component
class SavePasswordHandler(
    private val persistenceService: PasswordEntryService,
    private val stompSessionRegistry: StompSessionRegistry
) : AbstractVaultRequestHandler<SavePasswordRequestType>(SavePasswordRequestType::class) {
    private val logger = LoggerFactory.getLogger(SavePasswordHandler::class.java)

    override fun handle(message: VaultRequestMessageDto<SavePasswordRequestType>, headers: StompHeaders) {
        val payload = message.payload
        val messageId = message.messageId

        try {
            val passwordId = persistenceService.saveOrUpdate(payload, Base64.decode(payload.cipherText))

            stompSessionRegistry.send(
                StompEndpoints.USER_PASSWORD_SAVED,
                VaultResponseMessageDto(
                    messageId,
                    SavePasswordResponseType(
                        passwordId,
                        payload.domain
                    ),
                    VaultResponseStatus.OK
                )
            )
        } catch (e: Exception){
            logger.error("Failed to save password entry: ${payload.domain}", e)
            stompSessionRegistry.send(
                StompEndpoints.USER_PASSWORD_SAVED,
                VaultResponseMessageDto(
                    messageId,
                    SavePasswordResponseType(),
                    VaultResponseStatus.ERROR
                )
            )
            return
        }
    }

    override fun getDestination(): String {
        return StompEndpoints.SUBSCRIBE_SAVE_PASSWORD
    }
}
