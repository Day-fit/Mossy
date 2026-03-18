package pl.dayfit.mossypassword.messaging.consumer

import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.dto.response.PasswordQueryResponseDto
import pl.dayfit.mossypassword.service.PasswordQueryService
import java.lang.reflect.Type

@Component
class PasswordQueryResponseHandler(
    private val passwordQueryService: PasswordQueryService
) : StompFrameHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(PasswordQueryResponseHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type {
        return PasswordQueryResponseDto::class.java
    }

    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val response = payload as? PasswordQueryResponseDto
        
        if (response == null) {
            logger.warn("Received invalid password query response payload, ignoring it")
            return
        }
        
        passwordQueryService.handlePasswordQueryResponse(response)
    }
}
