package pl.dayfit.mossyvault.messaging.consumer

import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossyvault.service.PasswordEntryService
import java.lang.reflect.Type

@Component
class UpdatePasswordHandler(
    private val passwordEntryService: PasswordEntryService
) : StompFrameHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(UpdatePasswordHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type {
        return UpdatePasswordRequestDto::class.java
    }

    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val requestDto = payload as? UpdatePasswordRequestDto

        if (requestDto == null) {
            logger.warn("Received invalid payload, ignoring it")
            return
        }

        passwordEntryService.update(requestDto)
    }
}
