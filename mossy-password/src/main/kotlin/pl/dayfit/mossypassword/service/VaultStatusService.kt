package pl.dayfit.mossypassword.service

import org.springframework.amqp.core.Queue
import org.springframework.context.event.EventListener
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.messaging.simp.SimpMessageHeaderAccessor
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.socket.messaging.SessionConnectedEvent
import org.springframework.web.socket.messaging.SessionDisconnectEvent
import pl.dayfit.mossypassword.configuration.RedisPrefix
import pl.dayfit.mossypassword.dto.response.VaultStatusResponseDto
import pl.dayfit.mossypassword.repository.VaultRepository
import java.time.Instant
import java.util.UUID

@Service
class VaultStatusService(
    private val vaultRepository: VaultRepository,
    private val redisTemplate: RedisTemplate<String, String>,
    private val replicaQueue: Queue
) {
    fun getVaultsStatuses(userId: UUID): List<VaultStatusResponseDto> {
        return vaultRepository.findAllByOwnerId(userId)
            .map {
                VaultStatusResponseDto(
                    it.id!!,
                    it.name,
                    it.isOnline,
                    it.lastSeenAt,
                    it.passwordCount
                )
            }
    }

    @Transactional
    fun markOnline(vaultId: UUID) {
        val vault = vaultRepository.findById(vaultId).orElse(null) ?: return
        if (vault.isOnline) {
            return
        }

        redisTemplate.opsForValue()
            .set("${RedisPrefix.VAULT_LOCATION_PREFIX}:$vaultId", replicaQueue.name)
        vault.isOnline = true
        vault.lastSeenAt = Instant.now()
        vaultRepository.save(vault)
    }

    @Transactional
    fun markOffline(vaultId: UUID) {
        val vault = vaultRepository.findById(vaultId).orElse(null) ?: return
        if (!vault.isOnline) {
            return
        }

        vault.isOnline = false
        vaultRepository.save(vault)
        redisTemplate.delete("${RedisPrefix.VAULT_LOCATION_PREFIX}:$vaultId")
    }

    @Transactional
    @EventListener(SessionConnectedEvent::class)
    fun markOnline(event: SessionConnectedEvent) {
        val accessor = SimpMessageHeaderAccessor.wrap(event.message)
        val vaultIdHeader = accessor.getFirstNativeHeader("vault-id")
        val principalName = accessor.user?.name
        val vaultId = runCatching {
            UUID.fromString(vaultIdHeader ?: principalName ?: return)
        }.getOrNull() ?: return

        markOnline(vaultId)
    }

    @Transactional
    @EventListener(SessionDisconnectEvent::class)
    fun markOffline(event: SessionDisconnectEvent) {
        val accessor = SimpMessageHeaderAccessor.wrap(event.message)
        val vaultIdHeader = accessor.getFirstNativeHeader("vault-id")
        val principalName = accessor.user?.name
        val vaultId = runCatching {
            UUID.fromString(vaultIdHeader ?: principalName ?: return)
        }.getOrNull() ?: return

        markOffline(vaultId)
    }
}
