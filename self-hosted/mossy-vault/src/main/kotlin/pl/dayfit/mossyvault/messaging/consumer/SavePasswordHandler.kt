package pl.dayfit.mossyvault.messaging.consumer

import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.dto.request.SavePasswordRequestDto
import pl.dayfit.mossyvault.model.PasswordEntry
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import java.lang.reflect.Type
import java.time.Instant
import kotlin.io.encoding.Base64

@Component
class SavePasswordHandler(
    private val passwordEntryRepository: PasswordEntryRepository
) : StompFrameHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(SavePasswordHandler::class.java)

    override fun getPayloadType(headers: StompHeaders?): Type? {
        return SavePasswordRequestDto::class.java
    }

    /**
     * Handles an incoming STOMP frame containing a payload with password data.
     * Processes the payload by decoding the encrypted blob and saving the resulting password entry
     * into the repository.
     *
     * @param headers the headers of the STOMP frame, which may contain meta-information
     *                about the frame, can be null.
     * @param payload the payload of the STOMP frame, expected to be of type `SavePasswordRequestDto`;
     *                can be null.
     */
    override fun handleFrame(headers: StompHeaders?, payload: Any?) {
        val requestDto = payload as? SavePasswordRequestDto

        if (requestDto == null) {
            logger.warn("Received invalid payload, ignoring it")
            return
        }

        val decodedBlob = Base64.decode(requestDto.encryptedBlob)

        val passwordEntry = PasswordEntry(
            null,
            requestDto.identifier,
            decodedBlob,
            requestDto.domain,
            Instant.now()
        )

        passwordEntryRepository.save(passwordEntry)
    }
}