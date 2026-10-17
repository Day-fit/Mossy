package pl.dayfit.mossykeysync.service

import org.apache.commons.codec.binary.Base32
import org.slf4j.LoggerFactory
import org.springframework.context.ApplicationEventPublisher
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import pl.dayfit.mossykeysync.dto.request.UploadKeyDto
import pl.dayfit.mossykeysync.dto.response.InitKeySyncResponseDto
import pl.dayfit.mossykeysync.dto.response.VaultKeyResponseDto
import pl.dayfit.mossykeysync.event.KeySyncEvent
import pl.dayfit.mossykeysync.exception.InvalidKeyUploadedException
import pl.dayfit.mossykeysync.model.redis.KeySyncInfo
import pl.dayfit.mossykeysync.model.redis.VaultKey
import pl.dayfit.mossykeysync.repository.redis.VaultKeyRepository
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.util.UUID

@Service
class KeySyncService(
    private val vaultKeyRepository: VaultKeyRepository,
    private val secureRandom: SecureRandom,
    private val redisTemplate: RedisTemplate<String, KeySyncInfo>,
    private val applicationEventPublisher: ApplicationEventPublisher
) {
    private val logger = LoggerFactory.getLogger(KeySyncService::class.java)

    companion object {
        private const val ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
        private val codec = Base32.builder()
            .setEncodeTable(*ALPHABET.toByteArray(StandardCharsets.US_ASCII))
            .get()
    }

    fun initKeySync(
        userId: UUID,
        deviceId: UUID,
        vaultId: UUID
    ): InitKeySyncResponseDto {
        val code = generateSyncCode()

        redisTemplate.opsForValue()
            .set(
                "$userId:$code", KeySyncInfo(userId,
                vaultId,
                deviceId
            ))

        return InitKeySyncResponseDto(
            code
        )
    }


    fun processKeyUpload(userId: UUID, deviceId: UUID, code: String, dto: UploadKeyDto) {
        val info = redisTemplate.opsForValue()
            .getAndDelete("$userId:$code")

        if (info == null) {
            throw NoSuchElementException("Invalid code")
        }

        val receiverId = info.receiverId

        //Should never happen as write key is userId:code
        if (info.userId != userId) {
            logger.error("User ID mismatch: {}", userId)
            applicationEventPublisher.publishEvent(
                KeySyncEvent(
                    receiverId,
                    KeySyncEvent.Result.FAILED,
                    IllegalStateException("Invalid sender connected")
                )
            )
            throw AccessDeniedException("User id '$userId' does not belong to this key upload")
        }

        if (info.vaultId != dto.vaultId) {
            val ex = InvalidKeyUploadedException()
            applicationEventPublisher.publishEvent(
                KeySyncEvent(
                    receiverId,
                    KeySyncEvent.Result.FAILED,
                    IllegalStateException("Invalid sender connected")
                )
            )
            throw ex
        }

        vaultKeyRepository.save(
            VaultKey(
                info.receiverId,
                info.vaultId,
                dto.ciphertext,
                deviceId,
                dto.publicDh.x()
            )
        )

        applicationEventPublisher.publishEvent(
            KeySyncEvent(
                receiverId,
                KeySyncEvent.Result.SUCCESS,
            )
        )
    }

    fun getVaultKeys(deviceId: UUID): List<VaultKeyResponseDto> {
        return vaultKeyRepository.findAllByReceiverId(deviceId)
            .map {
                VaultKeyResponseDto(
                    it.vaultId,
                    it.senderId,
                    it.cipherText,
                )
            }
    }

    /**
     * Generates 6-digit sync code
     * @return generated sync code
     */
    private fun generateSyncCode(): String {
        val bytes = ByteArray(6)
        secureRandom.nextBytes(bytes)
        val rawCode = codec.encodeToString(bytes)
        return rawCode.substring(0, 6)
    }

    private fun Map<String, Any>.x(): String =
        this["x"] as? String ?: throw IllegalArgumentException("DH public key is missing x")
}
