package pl.dayfit.mossyvault.messaging.consumer

import org.slf4j.LoggerFactory
import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.dto.request.SavePasswordAckRequestDto
import pl.dayfit.mossyvault.dto.request.SavePasswordAckStatus
import pl.dayfit.mossyvault.dto.request.SavePasswordRequestDto
import pl.dayfit.mossyvault.service.PasswordEntryService
import pl.dayfit.mossyvault.service.StompSessionRegistry
import java.lang.reflect.Type
import java.security.MessageDigest
import java.util.UUID
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

        val vaultId = runCatching { UUID.fromString(dto.vaultId) }.getOrElse {
            logger.warn("Received invalid vaultId={}, cannot process save", dto.vaultId)
            return
        }

        val passwordId = dto.passwordId ?: generateDeterministicUUID(dto.vaultId, dto.domain, dto.identifier)

        val result = runCatching {
            persistenceService.saveOrUpdate(passwordId, dto, Base64.decode(dto.cipherText))
        }

        stompSessionRegistry.send(
            "/app/vault/password-save-ack",
            SavePasswordAckRequestDto(
                vaultId = vaultId,
                passwordId = passwordId,
                domain = dto.domain,
                identifier = dto.identifier,
                status = if (result.isSuccess) SavePasswordAckStatus.ACK else SavePasswordAckStatus.NACK,
                reason = result.exceptionOrNull()?.message
            )
        )

        result.onFailure { logger.error("Failed to save passwordId={}", passwordId, it) }
    }

    private fun generateDeterministicUUID(vaultId: String, domain: String, identifier: String): UUID {
        val bytes = MessageDigest.getInstance("SHA-1").digest("$vaultId:$domain:$identifier".toByteArray())
        bytes[6] = (bytes[6].toInt() and 0x0f or 0x50).toByte()
        bytes[8] = (bytes[8].toInt() and 0x3f or 0x80).toByte()
        val fold = { slice: List<Byte> -> slice.foldIndexed(0L) { i, acc, b -> acc or (b.toLong() and 0xFF shl (8 * (7 - i))) } }
        return UUID(fold(bytes.slice(0..7)), fold(bytes.slice(8..15)))
    }
}