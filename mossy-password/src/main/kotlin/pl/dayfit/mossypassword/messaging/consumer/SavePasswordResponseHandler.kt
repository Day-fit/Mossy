package pl.dayfit.mossypassword.messaging.consumer

import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.dto.request.SavePasswordAckRequestDto
import pl.dayfit.mossypassword.service.VaultCommunicationService
import java.lang.reflect.Type

@Component
class SavePasswordResponseHandler(
    private val vaultCommunicationService: VaultCommunicationService
) : StompFrameHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(SavePasswordResponseHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type {
        return SavePasswordAckRequestDto::class.java
    }

    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val response = payload as? SavePasswordAckRequestDto
        
        if (response == null) {
            logger.warn("Received invalid save password response payload, ignoring it")
            return
        }
        
        vaultCommunicationService.handleSavePasswordAck(response)
    }
}
