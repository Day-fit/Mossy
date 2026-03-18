package pl.dayfit.mossyvault.messaging.consumer

import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.dto.request.SavePasswordAckRequestDto
import pl.dayfit.mossyvault.dto.request.SavePasswordAckStatus
import pl.dayfit.mossyvault.dto.request.SavePasswordRequestDto
import pl.dayfit.mossyvault.model.PasswordEntry
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import java.lang.reflect.Type
import java.time.Instant
import java.util.UUID
import kotlin.io.encoding.Base64

@Component
class SavePasswordHandler(
    private val passwordEntryRepository: PasswordEntryRepository,
    private val stompSessionRegistry: StompSessionRegistry
) : StompFrameHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(SavePasswordHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type {
        return SavePasswordRequestDto::class.java
    }

    /**
     * Handles an incoming STOMP frame containing a payload with password data.
     * Processes the payload by decoding the encrypted blob, generating a deterministic password ID,
     * and saving the resulting password entry into the repository.
     * Sends the password ID back to the requesting vault via STOMP.
     *
     * @param headers the headers of the STOMP frame, which may contain meta-information
     *                about the frame, can be null.
     * @param payload the payload of the STOMP frame, expected to be of type `SavePasswordRequestDto`;
     *                can be null.
     */
    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val requestDto = payload as? SavePasswordRequestDto

        if (requestDto == null) {
            logger.warn("Received invalid payload, ignoring it")
            return
        }

        val vaultId = runCatching { UUID.fromString(requestDto.vaultId) }.getOrElse {
            logger.warn("Received invalid vault id={}, cannot process save", requestDto.vaultId)
            return
        }

        val passwordId = requestDto.passwordId ?: generateDeterministicUUID(
            requestDto.vaultId,
            requestDto.domain,
            requestDto.identifier
        )

        try {
            val decodedBlob = Base64.decode(requestDto.cipherText)

            val passwordEntry = PasswordEntry(
                passwordId,
                requestDto.identifier,
                decodedBlob,
                requestDto.domain,
                Instant.now()
            )

            passwordEntryRepository.save(passwordEntry)
            sendAck(
                SavePasswordAckRequestDto(
                    vaultId = vaultId,
                    passwordId = passwordId,
                    domain = requestDto.domain,
                    identifier = requestDto.identifier,
                    status = SavePasswordAckStatus.ACK
                )
            )
        } catch (exception: Exception) {
            logger.error(
                "Failed to save password for vaultId={}, passwordId={}",
                vaultId,
                passwordId,
                exception
            )

            sendAck(
                SavePasswordAckRequestDto(
                    vaultId = vaultId,
                    passwordId = passwordId,
                    domain = requestDto.domain,
                    identifier = requestDto.identifier,
                    status = SavePasswordAckStatus.NACK,
                    reason = exception.message ?: "Save failed"
                )
            )
        }
    }

    private fun sendAck(ack: SavePasswordAckRequestDto) {
        val sent = stompSessionRegistry.send(
            "/app/vault/password-save-ack",
            ack
        )

        if (!sent) {
            logger.warn(
                "Vault STOMP session unavailable, could not send {} for passwordId={}",
                ack.status,
                ack.passwordId
            )
        }
    }

    /**
     * Generates a deterministic UUID based on vault ID and domain using namespace-based UUID v5
     */
    private fun generateDeterministicUUID(vaultId: String, domain: String, identifier: String): UUID {
        val input = "$vaultId:$domain:$identifier".toByteArray()
        val bytes = java.security.MessageDigest.getInstance("SHA-1").digest(input)
        
        bytes[6] = (bytes[6].toInt() and 0x0f or 0x50).toByte()
        bytes[8] = (bytes[8].toInt() and 0x3f or 0x80).toByte()
        
        val mostSigBits = bytes.slice(0..7)
            .foldIndexed(0L) { i, acc, byte -> acc or (byte.toLong() and 0xFFL shl (8 * (7 - i))) }
        val leastSigBits = bytes.slice(8..15)
            .foldIndexed(0L) { i, acc, byte -> acc or (byte.toLong() and 0xFFL shl (8 * (7 - i))) }
        
        return UUID(mostSigBits, leastSigBits)
    }
}