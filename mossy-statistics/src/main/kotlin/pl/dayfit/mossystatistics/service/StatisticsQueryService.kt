package pl.dayfit.mossystatistics.service

import org.springframework.stereotype.Service
import pl.dayfit.mossystatistics.dto.response.DashboardResponseDto
import pl.dayfit.mossystatistics.dto.response.PasswordChartPointDto
import pl.dayfit.mossystatistics.dto.response.RecentActionDto
import pl.dayfit.mossystatistics.type.ActionType
import pl.dayfit.mossystatistics.repository.PasswordActionEventRepository
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

@Service
class StatisticsQueryService(
    private val passwordActionEventRepository: PasswordActionEventRepository,
) {
    companion object {
        // 30 days in seconds
        private const val MONTH_CHART_VIEW = 30 * 60 * 60 * 24L
    }

    fun getDashboardStatistics(userId: UUID): DashboardResponseDto {
        val from = Instant.now().minusSeconds(MONTH_CHART_VIEW)
        val chartData = buildChart(from, userId)
        val recentActions = passwordActionEventRepository.findTop20ByUserIdOrderByEventTimestampDesc(userId).map {
            RecentActionDto(
                date = it.eventTimestamp,
                actionType = it.actionType,
                domain = it.domain,
                vaultId = it.vaultId,
            )
        }

        return DashboardResponseDto(
            passwordChart = chartData,
            recentActions = recentActions,
        )
    }

    private fun buildChart(from: Instant, userId: UUID): List<PasswordChartPointDto> {
        val events = passwordActionEventRepository.findByActionTypeAndEventTimestampAfterAndUserId(
            ActionType.ADDED,
            from,
            userId
        )

        return events.groupBy { it.eventTimestamp.truncatedTo(ChronoUnit.DAYS) }
            .map { (timestamp, eventGroup) ->
                PasswordChartPointDto(
                    timestamp,
                    eventGroup.size.toLong()
                )
            }
    }
}
