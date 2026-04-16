package pl.dayfit.mossystatistics.dto.response

import pl.dayfit.mossystatistics.type.ActionType
import java.time.Instant
import java.util.UUID

data class DashboardResponseDto(
    val passwordChart: List<PasswordChartPointDto>,
    val recentActions: List<RecentActionDto>,
)

data class PasswordChartPointDto(
    val date: Instant,
    val addedCount: Long
)

data class RecentActionDto(
    val date: Instant,
    val actionType: ActionType,
    val domain: String,
    val vaultId: UUID
)
