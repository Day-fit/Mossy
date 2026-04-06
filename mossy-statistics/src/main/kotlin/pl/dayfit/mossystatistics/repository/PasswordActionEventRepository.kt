package pl.dayfit.mossystatistics.repository

import org.springframework.data.jpa.repository.JpaRepository
import pl.dayfit.mossystatistics.type.ActionType
import pl.dayfit.mossystatistics.model.PasswordActionEvent
import java.time.Instant
import java.util.UUID

interface PasswordActionEventRepository : JpaRepository<PasswordActionEvent, UUID> {
    fun findTop20ByUserIdOrderByEventTimestampDesc(userId: UUID): List<PasswordActionEvent>

    fun existsPasswordActionEventsByActionId(actionId: UUID): Boolean
    fun findByActionTypeAndEventTimestampAfterAndUserId(
        actionType: ActionType,
        eventTimestampAfter: Instant,
        userId: UUID
    ): MutableList<PasswordActionEvent>
}
