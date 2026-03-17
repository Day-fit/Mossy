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

    @Transactional
    @EventListener(SessionConnectedEvent::class)
    fun markOnline(event: SessionConnectedEvent) {
        val accessor = SimpMessageHeaderAccessor.wrap(event.message)
        val vaultIdHeader = accessor.getFirstNativeHeader("vault-id")
                ?: throw IllegalStateException("Vault ID header is missing, but must be present")
        val vaultId = UUID.fromString(vaultIdHeader)

        val vault = vaultRepository.findById(vaultId).orElse(null) ?: return
        if (!vault.isOnline) {
            vault.isOnline = true
            vaultRepository.save(vault)
        }
    }

    @Transactional
    @EventListener(SessionDisconnectEvent::class)
    fun markOffline(event: SessionDisconnectEvent) {
        val accessor = SimpMessageHeaderAccessor.wrap(event.message)
        val vaultIdHeader = accessor.getFirstNativeHeader("vault-id")
            ?: throw IllegalStateException("Vault ID header is missing, but must be present")
        val vaultId = UUID.fromString(vaultIdHeader)

        val vault = vaultRepository.findById(vaultId).orElse(null) ?: return
        if (vault.isOnline) {
            vault.isOnline = false
            vaultRepository.save(vault)
        }
    }
}
