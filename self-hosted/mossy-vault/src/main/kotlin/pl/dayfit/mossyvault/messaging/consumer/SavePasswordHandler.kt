package pl.dayfit.mossyvault.messaging.consumer

import messaging.VaultRequestMessageDto
import messaging.VaultResponseMessageDto
import messaging.request.type.SavePasswordRequestType
import messaging.response.type.SavePasswordResponseType
import org.slf4j.LoggerFactory
import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.service.PasswordEntryService
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import java.lang.reflect.Type
import kotlin.io.encoding.Base64

@Component
class SavePasswordHandler(
    private val persistenceService: PasswordEntryService,
    private val stompSessionRegistry: StompSessionRegistry
) : StompFrameHandler {
    private val logger = LoggerFactory.getLogger(SavePasswordHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type = VaultRequestMessageDto::class.java

    @Suppress("UNCHECKED_CAST")
    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val requestDto = payload as? VaultRequestMessageDto<SavePasswordRequestType> ?: run {
            logger.warn("Received invalid payload, ignoring it")
            return
        }

        val requestPayload = requestDto.payload

        val result = runCatching {
            persistenceService.saveOrUpdate(requestPayload, Base64.decode(requestPayload.cipherText))
        }

        if (result.isFailure) {
            logger.error("Failed to save password", result.exceptionOrNull())
            stompSessionRegistry.send(
                StompEndpoints.USER_PASSWORD_SAVED,
                VaultResponseMessageDto(
                    requestDto.correlationId,
                    SavePasswordResponseType(),
                    VaultResponseStatus.ERROR
                )
            )
        }

        stompSessionRegistry.send(
            StompEndpoints.USER_PASSWORD_SAVED,
            VaultResponseMessageDto(
                requestDto.correlationId,
                SavePasswordResponseType(),
                VaultResponseStatus.OK
            )
        )
    }
}