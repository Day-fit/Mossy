package pl.dayfit.mossypassword.service

import org.springframework.context.event.EventListener
import org.springframework.messaging.simp.SimpMessageHeaderAccessor
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.socket.messaging.SessionConnectedEvent
import org.springframework.web.socket.messaging.SessionDisconnectEvent
import pl.dayfit.mossypassword.dto.response.VaultStatusResponseDto
import pl.dayfit.mossypassword.repository.VaultRepository
import java.util.UUID

@Service
class VaultStatusService(
    private val vaultRepository: VaultRepository
) {
    fun getVaults(userId: UUID): List<VaultStatusResponseDto>  {
        return vaultRepository.findAllByOwnerId(userId)
            .map {
                VaultStatusResponseDto(
                    it.id!!,
                    it.name,
                    it.isOnline
                )
            }
    }

    fun getAllVaultStatuses(): List<VaultStatusResponseDto> {
        return vaultRepository.findAll()
            .map {
                VaultStatusResponseDto(
                    vaultId = it.id!!,
                    vaultName = it.name,
                    isOnline = it.isOnline
                )
            }
    }

    @Transactional
    fun markOnline(vaultId: UUID) {
        val vault = vaultRepository.findById(vaultId).orElse(null) ?: return
        if (!vault.isOnline) {
            vault.isOnline = true
            vaultRepository.save(vault)
        }
    }

    @Transactional
    fun markOffline(vaultId: UUID) {
        val vault = vaultRepository.findById(vaultId).orElse(null) ?: return
        if (vault.isOnline) {
            vault.isOnline = false
            vaultRepository.save(vault)
        }
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
