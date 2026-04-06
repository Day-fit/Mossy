package pl.dayfit.mossyvault.messaging.consumer

import org.slf4j.LoggerFactory
import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.dto.request.SavePasswordAckRequestDto
import pl.dayfit.mossyvault.dto.request.SavePasswordRequestDto
import pl.dayfit.mossyvault.service.PasswordEntryService
import pl.dayfit.mossyvault.service.StompSessionRegistry
import pl.dayfit.mossyvault.types.AckStatus
import java.lang.reflect.Type
import kotlin.io.encoding.Base64

@Component
class SavePasswordHandler(
    private val persistenceService: PasswordEntryService,
    private val stompSessionRegistry: StompSessionRegistry
) : StompFrameHandler {
    private val logger = LoggerFactory.getLogger(SavePasswordHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type = SavePasswordRequestDto::class.java

    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val dto = payload as? SavePasswordRequestDto ?: run {
            logger.warn("Received invalid payload, ignoring it")
            return
        }

        val result = runCatching {
            persistenceService.saveOrUpdate(dto, Base64.decode(dto.cipherText))
        }

        stompSessionRegistry.send(
            StompEndpoints.SEND_SAVE_ACK,
            SavePasswordAckRequestDto(
                passwordId = result.getOrNull(),
                domain = dto.domain,
                status = if (result.isSuccess) AckStatus.ACK else AckStatus.NACK,
                reason = result.exceptionOrNull()?.message
            )
        )
    }
}