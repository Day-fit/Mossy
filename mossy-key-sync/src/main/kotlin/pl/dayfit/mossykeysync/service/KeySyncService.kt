package pl.dayfit.mossykeysync.service

import org.apache.commons.codec.binary.Base32
import org.slf4j.LoggerFactory
import org.springframework.context.ApplicationEventPublisher
import org.springframework.data.redis.connection.RedisHashCommands.HashFieldSetOption
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.types.Expiration
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import pl.dayfit.mossykeysync.dto.request.InitKeySyncRequestDto
import pl.dayfit.mossykeysync.dto.request.UploadKeyDto
import pl.dayfit.mossykeysync.dto.response.InitKeySyncResponseDto
import pl.dayfit.mossykeysync.dto.response.PendingReceiverResponseDto
import pl.dayfit.mossykeysync.dto.response.VaultKeyResponseDto
import pl.dayfit.mossykeysync.dto.response.VaultKeysResponseDto
import pl.dayfit.mossykeysync.event.KeySyncEvent
import pl.dayfit.mossykeysync.exception.InvalidKeyUploadedException
import pl.dayfit.mossykeysync.model.redis.KeySyncInfo
import pl.dayfit.mossykeysync.model.redis.VaultKey
import pl.dayfit.mossykeysync.repository.redis.VaultKeyRepository
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.time.Duration
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
        private val REQUEST_TTL = Duration.ofMinutes(15)
        private val codec = Base32.builder()
            .setEncodeTable(*ALPHABET.toByteArray(StandardCharsets.US_ASCII))
            .get()
    }

    fun initKeySync(
        userId: UUID,
        deviceId: UUID,
        dto: InitKeySyncRequestDto,
    ): InitKeySyncResponseDto {
        val code = generateSyncCode()
        val info = KeySyncInfo(userId, dto.vaultId, deviceId, dto.publicDh, dto.signature)

        redisTemplate.opsForValue().set("$userId:$code", info, REQUEST_TTL)
        try {
            val pending = redisTemplate.opsForHash<String, KeySyncInfo>()
            // Store the field and its TTL atomically; newer requests cannot extend older ones.
            pending.putAndExpire(
                "$userId:pending-key-sync",
                mapOf(code to info),
                HashFieldSetOption.UPSERT,
                Expiration.from(REQUEST_TTL),
            )
        } catch (ex: Exception) {
            redisTemplate.delete("$userId:$code")
            redisTemplate.opsForHash<String, KeySyncInfo>().delete("$userId:pending-key-sync", code)
            throw ex
        }

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
        try {
            redisTemplate.opsForHash<String, KeySyncInfo>().delete("$userId:pending-key-sync", code)

            // Should never happen as the Redis key is userId:code.
            if (info.userId != userId) {
                logger.error("User ID mismatch: {}", userId)
                throw AccessDeniedException("User id '$userId' does not belong to this key upload")
            }

            if (info.vaultId != dto.vaultId) {
                throw InvalidKeyUploadedException()
            }

            vaultKeyRepository.save(
                VaultKey(
                    info.receiverId,
                    info.vaultId,
                    dto.ciphertext,
                    deviceId,
                    dto.publicDh.x(),
                    code,
                )
            )
        } catch (ex: Exception) {
            applicationEventPublisher.publishEvent(
                KeySyncEvent(
                    info.receiverId,
                    code,
                    KeySyncEvent.Result.FAILED,
                    ex,
                )
            )
            throw ex
        }

        applicationEventPublisher.publishEvent(
            KeySyncEvent(
                info.receiverId,
                code,
                KeySyncEvent.Result.SUCCESS,
            )
        )
    }

    fun getVaultKeys(deviceId: UUID): VaultKeysResponseDto {
        val keys = vaultKeyRepository.findAllByReceiverId(deviceId)
            .map {
                VaultKeyResponseDto(
                    it.vaultId,
                    it.senderId,
                    it.cipherText,
                    it.senderPublicDh,
                    it.code,
                )
            }
        return VaultKeysResponseDto(keys)
    }

    fun getPendingReceivers(userId: UUID): List<PendingReceiverResponseDto> {
        return redisTemplate.opsForHash<String, KeySyncInfo>()
            .entries("$userId:pending-key-sync")
            .filterValues { it.userId == userId }
            .map { (code, info) ->
                PendingReceiverResponseDto(code, info.receiverId, info.vaultId, info.publicDh, info.signature)
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
