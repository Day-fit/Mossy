package pl.dayfit.mossypassword.service

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.amqp.core.Queue
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.ValueOperations
import pl.dayfit.mossypassword.configuration.RedisPrefix
import pl.dayfit.mossypassword.model.Vault
import pl.dayfit.mossypassword.repository.VaultRepository
import java.time.Instant
import java.util.Optional
import java.util.UUID
import kotlin.test.assertTrue

class VaultStatusServiceTest {
    private val vaultRepository: VaultRepository = mock()
    private val redisTemplate: RedisTemplate<String, String> = mock()
    private val valueOperations: ValueOperations<String, String> = mock()
    private val replicaQueue: Queue = mock()
    private val service = VaultStatusService(vaultRepository, redisTemplate, replicaQueue)

    @Test
    fun `markOnline refreshes replica location even if vault is already online`() {
        val vaultId = UUID.randomUUID()
        val oldLastSeenAt = Instant.now().minusSeconds(120)
        val vault = Vault(
            id = vaultId,
            ownerId = UUID.randomUUID(),
            name = "vault",
            secretHash = "hash",
            isOnline = true,
            lastSeenAt = oldLastSeenAt
        )

        whenever(vaultRepository.findById(vaultId)).thenReturn(Optional.of(vault))
        whenever(redisTemplate.opsForValue()).thenReturn(valueOperations)
        whenever(replicaQueue.name).thenReturn("replica.queue.1")
        whenever(vaultRepository.save(vault)).thenReturn(vault)

        service.markOnline(vaultId)

        verify(valueOperations).set(
            "${RedisPrefix.VAULT_LOCATION_PREFIX}:$vaultId",
            "replica.queue.1"
        )
        verify(vaultRepository).save(vault)
        assertTrue(vault.lastSeenAt != null && vault.lastSeenAt!!.isAfter(oldLastSeenAt))
        assertTrue(vault.isOnline)
    }

    @Test
    fun `markOffline always clears stale replica location for offline vault`() {
        val vaultId = UUID.randomUUID()
        val vault = Vault(
            id = vaultId,
            ownerId = UUID.randomUUID(),
            name = "vault",
            secretHash = "hash",
            isOnline = false
        )

        whenever(vaultRepository.findById(vaultId)).thenReturn(Optional.of(vault))

        service.markOffline(vaultId)

        verify(redisTemplate).delete("${RedisPrefix.VAULT_LOCATION_PREFIX}:$vaultId")
        verify(vaultRepository, never()).save(any())
    }

    @Test
    fun `markOffline updates online vault state and clears replica location`() {
        val vaultId = UUID.randomUUID()
        val vault = Vault(
            id = vaultId,
            ownerId = UUID.randomUUID(),
            name = "vault",
            secretHash = "hash",
            isOnline = true
        )

        whenever(vaultRepository.findById(vaultId)).thenReturn(Optional.of(vault))
        whenever(vaultRepository.save(vault)).thenReturn(vault)

        service.markOffline(vaultId)

        verify(redisTemplate).delete(eq("${RedisPrefix.VAULT_LOCATION_PREFIX}:$vaultId"))
        verify(vaultRepository).save(vault)
        assertTrue(!vault.isOnline)
    }
}
