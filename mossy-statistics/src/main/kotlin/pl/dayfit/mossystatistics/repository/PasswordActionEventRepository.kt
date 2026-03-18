package pl.dayfit.mossystatistics.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import pl.dayfit.mossystatistics.model.ActionType
import pl.dayfit.mossystatistics.model.PasswordActionEvent
import java.time.Instant
import java.util.UUID

interface PasswordActionEventRepository : JpaRepository<PasswordActionEvent, UUID> {
    fun findTop20ByOrderByEventTimestampDesc(): List<PasswordActionEvent>
    fun findTop20ByVaultIdInOrderByEventTimestampDesc(vaultIds: Collection<UUID>): List<PasswordActionEvent>

    @Query(
        """
        SELECT e FROM PasswordActionEvent e
        WHERE e.actionType = :actionType
        AND e.eventTimestamp >= :from
        ORDER BY e.eventTimestamp ASC
        """
    )
    fun findByActionTypeFrom(
        @Param("actionType") actionType: ActionType,
        @Param("from") from: Instant
    ): List<PasswordActionEvent>

    @Query(
        """
        SELECT e FROM PasswordActionEvent e
        WHERE e.actionType = :actionType
        AND e.vaultId IN :vaultIds
        AND e.eventTimestamp >= :from
        ORDER BY e.eventTimestamp ASC
        """
    )
    fun findByActionTypeFromAndVaultIds(
        @Param("actionType") actionType: ActionType,
        @Param("from") from: Instant,
        @Param("vaultIds") vaultIds: Collection<UUID>
    ): List<PasswordActionEvent>
}
