package pl.dayfit.mossystatistics.dto.response

data class DashboardResponseDto(
    val passwordChart: List<PasswordChartPointDto>,
    val recentActions: List<RecentActionDto>,
    val vaults: List<VaultDashboardDto>
)

data class PasswordChartPointDto(
    val date: String,
    val addedCount: Long
)

data class RecentActionDto(
    val date: String,
    val actionType: String,
    val domain: String
)

data class VaultDashboardDto(
    val passwordsCount: Long,
    val vaultName: String,
    val isOnline: Boolean
)
