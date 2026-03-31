package pl.dayfit.mossystatistics.dto.response

import java.time.Instant
import java.util.UUID

data class DashboardResponseDto(
    val passwordChart: List<PasswordChartPointDto>,
    val recentActions: List<RecentActionDto>,
    val vaults: List<VaultDashboardDto>
)

data class PasswordChartPointDto(
    val date: Instant,
    val addedCount: Long
)

data class RecentActionDto(
    val date: Instant,
    val actionType: String,
    val domain: String
)

data class VaultDashboardDto(
    val passwordsCount: Long,
    val vaultId: UUID,
    val lastSeenAt: Instant?
)
