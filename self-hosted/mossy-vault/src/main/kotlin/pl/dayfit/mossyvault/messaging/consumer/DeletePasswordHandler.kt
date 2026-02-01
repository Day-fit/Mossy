package pl.dayfit.mossyvault.messaging.consumer

import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import java.lang.reflect.Type

@Component
class DeletePasswordHandler(
    private val passwordEntryRepository: PasswordEntryRepository
) : StompFrameHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(DeletePasswordHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type {
        return DeletePasswordRequestDto::class.java
    }

    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val requestDto = payload as? DeletePasswordRequestDto

        if (requestDto == null) {
            logger.warn("Received invalid payload, ignoring it")
            return
        }

        passwordEntryRepository.deleteById(requestDto.passwordId)
    }
}