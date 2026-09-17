package pl.dayfit.mossystatistics.service

import org.springframework.stereotype.Service
import pl.dayfit.mossystatistics.dto.response.DashboardResponseDto
import pl.dayfit.mossystatistics.dto.response.PasswordChartPointDto
import pl.dayfit.mossystatistics.dto.response.RecentActionDto
import pl.dayfit.mossystatistics.type.ActionType
import pl.dayfit.mossystatistics.repository.PasswordActionEventRepository
import pl.dayfit.mossystatistics.repository.VaultStatisticsRepository
import java.time.Instant
import java.time.temporal.ChronoUnit
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
        val from = Instant.now().minusSeconds(MONTH_CHART_VIEW)
        val totalPasswords = vaultStatisticsRepository.findByUserId(userId).sumOf { it.passwordsCount }
        val chartData = buildChart(from, userId, totalPasswords)
        val recentActions = passwordActionEventRepository.findTop20ByUserIdOrderByEventTimestampDesc(userId).map {
            RecentActionDto(
                date = it.eventTimestamp,
                actionType = it.actionType,
                domain = it.domain,
                vaultId = it.vaultId,
            )
        }

        return DashboardResponseDto(
            totalPasswords = totalPasswords,
            passwordChart = chartData,
            recentActions = recentActions,
        )
    }

    private fun buildChart(from: Instant, userId: UUID, totalPasswords: Long): List<PasswordChartPointDto> {
        val events = passwordActionEventRepository.findByEventTimestampAfterAndUserId(from, userId)
        var passwordCount = totalPasswords - events.sumOf { countChange(it.actionType) }

        return events.groupBy { it.eventTimestamp.truncatedTo(ChronoUnit.DAYS) }
            .toSortedMap()
            .map { (timestamp, eventGroup) ->
                passwordCount = maxOf(0, passwordCount + eventGroup.sumOf { countChange(it.actionType) })
                PasswordChartPointDto(
                    date = timestamp,
                    passwordCount = passwordCount,
                    addedCount = eventGroup.count { it.actionType == ActionType.ADDED }.toLong(),
                )
            }
    }

    private fun countChange(actionType: ActionType): Long = when (actionType) {
        ActionType.ADDED -> 1
        ActionType.REMOVED -> -1
        ActionType.UPDATED -> 0
    }
}
