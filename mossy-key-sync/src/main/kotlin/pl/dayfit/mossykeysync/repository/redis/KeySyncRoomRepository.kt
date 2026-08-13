package pl.dayfit.mossykeysync.repository.redis

import org.springframework.data.repository.CrudRepository
import org.springframework.stereotype.Repository
import pl.dayfit.mossykeysync.model.redis.KeySyncRoom
import java.util.UUID

@Repository
interface KeySyncRoomRepository : CrudRepository<KeySyncRoom, String> {
    fun getKeySyncRoomsByUserId(userId: UUID): MutableList<KeySyncRoom>
}