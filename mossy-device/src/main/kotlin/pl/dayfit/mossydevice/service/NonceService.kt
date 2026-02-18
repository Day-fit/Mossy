package pl.dayfit.mossydevice.service

import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service
import pl.dayfit.mossydevice.repository.UserDeviceRepository
import java.security.SecureRandom
import java.time.Duration
import java.util.UUID
import kotlin.io.encoding.Base64

@Service
class NonceService(
    private val secureRandom: SecureRandom,
    private val stringRedisTemplate: StringRedisTemplate,
    private val deviceRepository: UserDeviceRepository
) {
    fun generateNonce(deviceId: UUID, userId: UUID): String {
        if (!deviceRepository.existsByDeviceIdAndUserId(deviceId, userId))
        {
            throw NoSuchElementException("Device with given id does not exist")
        }

        val rawNonce = ByteArray(16)
        secureRandom.nextBytes(rawNonce)
        val nonce = Base64.UrlSafe.encode(rawNonce)

        stringRedisTemplate.opsForValue()
            .set(
                deviceId.toString(),
                nonce,
                Duration.ofMinutes(5)
            )

        return nonce
    }

    /**
     * Retrieves and consumes the nonce associated with the given device ID.
     * The nonce is a single-use string token stored in a Redis datastore.
     * If no nonce exists for the provided device ID, an exception is thrown.
     * The retrieved nonce is removed from the data store after it is consumed.
     *
     * @param deviceId The unique identifier of the device for which the nonce is being retrieved.
     * @return The consumed nonce as a string.
     * @throws NoSuchElementException If there is no nonce associated with the given device ID.
     */
    @Throws(NoSuchElementException::class)
    fun getAndConsumeNonce(deviceId: UUID): ByteArray
    {
        val nonce = stringRedisTemplate.opsForValue()
            .get(deviceId.toString())

        if (nonce == null)
        {
            throw NoSuchElementException("There is no nonce for given device")
        }

        stringRedisTemplate.delete(deviceId.toString())
        return Base64.UrlSafe.decode(nonce)
    }
}