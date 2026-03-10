package pl.dayfit.mossyvault.messaging.consumer

import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import java.lang.reflect.Type
import java.time.Instant
import kotlin.io.encoding.Base64

@Component
class UpdatePasswordHandler(
    private val passwordEntryRepository: PasswordEntryRepository
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

        val passwordEntryOptional = passwordEntryRepository.findById(requestDto.passwordId)
        if (passwordEntryOptional.isEmpty) {
            logger.warn("Password entry not found, id={}", requestDto.passwordId)
            return
        }

        val passwordEntry = passwordEntryOptional.get()
        passwordEntry.identifier = requestDto.identifier
        passwordEntry.domain = requestDto.domain
        passwordEntry.encryptedBlob = Base64.decode(requestDto.cipherText)
        passwordEntry.lastModified = Instant.now()

        passwordEntryRepository.save(passwordEntry)
    }
}