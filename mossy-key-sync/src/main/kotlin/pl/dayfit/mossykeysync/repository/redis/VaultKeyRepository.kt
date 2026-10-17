package pl.dayfit.mossykeysync.repository.redis

import org.springframework.data.repository.CrudRepository
import org.springframework.stereotype.Repository
import pl.dayfit.mossykeysync.model.redis.VaultKey
import java.util.UUID

@Repository
interface VaultKeyRepository : CrudRepository<VaultKey, UUID> {
    fun findAllByReceiverId(receiverId: UUID): MutableList<VaultKey>
}