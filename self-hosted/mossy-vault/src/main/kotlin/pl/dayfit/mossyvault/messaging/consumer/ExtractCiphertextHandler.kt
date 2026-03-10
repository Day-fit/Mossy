package pl.dayfit.mossyvault.messaging.consumer

import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.dto.request.ExtractCiphertextRequestDto
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import java.lang.reflect.Type
import kotlin.io.encoding.Base64

@Component
class ExtractCiphertextHandler(
    private val passwordEntryRepository: PasswordEntryRepository
) : StompFrameHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(ExtractCiphertextHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type {
        return ExtractCiphertextRequestDto::class.java
    }

    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val requestDto = payload as? ExtractCiphertextRequestDto

        if (requestDto == null) {
            logger.warn("Received invalid payload, ignoring it")
            return
        }

        val passwordEntryOptional = passwordEntryRepository.findById(requestDto.passwordId)
        if (passwordEntryOptional.isEmpty) {
            logger.warn("Password entry not found, id={}", requestDto.passwordId)
            return
        }

        val encodedBlob = Base64.encode(passwordEntryOptional.get().encryptedBlob)
        logger.debug(
            "Ciphertext extracted for password id={}, size={}",
            requestDto.passwordId,
            encodedBlob.length
        )
    }
}