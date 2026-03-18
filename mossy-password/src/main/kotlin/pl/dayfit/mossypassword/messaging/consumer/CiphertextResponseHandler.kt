package pl.dayfit.mossypassword.messaging.consumer

import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.dto.response.CiphertextResponseDto
import pl.dayfit.mossypassword.service.PasswordQueryService
import java.lang.reflect.Type

@Component
class CiphertextResponseHandler(
    private val passwordQueryService: PasswordQueryService
) : StompFrameHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(CiphertextResponseHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type {
        return CiphertextResponseDto::class.java
    }

    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val response = payload as? CiphertextResponseDto
        
        if (response == null) {
            logger.warn("Received invalid ciphertext response payload, ignoring it")
            return
        }
        
        passwordQueryService.handleCiphertextResponse(response)
    }
}
