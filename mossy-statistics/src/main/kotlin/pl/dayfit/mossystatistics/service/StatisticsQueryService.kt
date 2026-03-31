package pl.dayfit.mossystatistics.service

import org.springframework.stereotype.Service
import pl.dayfit.mossystatistics.dto.response.DashboardResponseDto
import pl.dayfit.mossystatistics.dto.response.PasswordChartPointDto
import pl.dayfit.mossystatistics.dto.response.RecentActionDto
import pl.dayfit.mossystatistics.dto.response.VaultDashboardDto
import pl.dayfit.mossystatistics.type.ActionType
import pl.dayfit.mossystatistics.repository.PasswordActionEventRepository
import pl.dayfit.mossystatistics.repository.VaultStatisticsRepository
import java.time.Instant
import java.util.UUID

@Service
class StatisticsQueryService(
    private val passwordActionEventRepository: PasswordActionEventRepository,
    private val vaultStatisticsRepository: VaultStatisticsRepository,
) {
    companion object {
        // 30 days in seconds
        private const val MONTH_CHART_VIEW = 30 * 60 * 60 * 24L
    }

    fun getDashboardStatistics(userId: UUID): DashboardResponseDto {
        val persistedVaultStats = vaultStatisticsRepository.findByUserId(userId)
            .sortedByDescending { it.lastSeenAt }

        val vaultIds = persistedVaultStats.map { it.vaultId }
            .toMutableList()

        if (vaultIds.isEmpty()) {
            return DashboardResponseDto(
                passwordChart = emptyList(),
                recentActions = emptyList(),
                vaults = emptyList()
            )
        }

        val from = Instant.now().minusSeconds(MONTH_CHART_VIEW)
        val chartData = buildChart(from, vaultIds)
        val recentActions = passwordActionEventRepository.findTop20ByVaultIdInOrderByEventTimestampDesc(vaultIds).map {
            RecentActionDto(
                date = it.eventTimestamp,
                actionType = it.actionType.name.lowercase(),
                domain = it.domain
            )
        }

        val vaults = persistedVaultStats.map {
            VaultDashboardDto(
                it.passwordsCount,
                it.vaultId,
                it.lastSeenAt,
            )
        }

        return DashboardResponseDto(
            passwordChart = chartData,
            recentActions = recentActions,
            vaults = vaults
        )
    }

    private fun buildChart(from: Instant, vaultIds: MutableCollection<UUID>): List<PasswordChartPointDto> {
        val events = passwordActionEventRepository.findByActionTypeAndEventTimestampAfterAndVaultIdIn(
            ActionType.ADDED,
            from,
            vaultIds
        )

        return events.groupBy { it.eventTimestamp }
            .map { (timestamp, eventGroup) ->
                PasswordChartPointDto(
                    timestamp,
                    eventGroup.size.toLong()
                )
            }
    }
}
