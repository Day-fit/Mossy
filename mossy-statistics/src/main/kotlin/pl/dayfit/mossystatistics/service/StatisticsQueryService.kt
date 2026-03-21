package pl.dayfit.mossystatistics.service

import org.springframework.http.HttpHeaders
import org.springframework.stereotype.Service
import org.springframework.web.client.RestClient
import org.springframework.web.client.body
import pl.dayfit.mossystatistics.dto.response.DashboardResponseDto
import pl.dayfit.mossystatistics.dto.response.PasswordChartPointDto
import pl.dayfit.mossystatistics.dto.response.RecentActionDto
import pl.dayfit.mossystatistics.dto.response.VaultDashboardDto
import pl.dayfit.mossystatistics.dto.client.VaultStatusClientDto
import pl.dayfit.mossystatistics.model.ActionType
import pl.dayfit.mossystatistics.repository.PasswordActionEventRepository
import pl.dayfit.mossystatistics.repository.VaultStatisticsRepository
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID

@Service
class StatisticsQueryService(
    private val passwordActionEventRepository: PasswordActionEventRepository,
    private val vaultStatisticsRepository: VaultStatisticsRepository,
    private val mossyPasswordRestClient: RestClient
) {
    fun getDashboardStatistics(authorizationHeader: String): DashboardResponseDto {
        val vaultStatuses = fetchVaultStatuses(authorizationHeader)
        val vaultStatusesById = vaultStatuses.associateBy { it.vaultId }
        val vaultIds = vaultStatusesById.keys

        if (vaultIds.isEmpty()) {
            return DashboardResponseDto(
                passwordChart = emptyList(),
                recentActions = emptyList(),
                vaults = emptyList()
            )
        }

        val from = Instant.now().minusSeconds(CHART_WINDOW_DAYS * DAY_SECONDS)
        val chartData = buildChart(from, vaultIds)
        val recentActions = passwordActionEventRepository.findTop20ByVaultIdInOrderByEventTimestampDesc(vaultIds).map {
            RecentActionDto(
                date = it.eventTimestamp.toString(),
                actionType = it.actionType.name.lowercase(),
                domain = it.domain
            )
        }
        val persistedVaultStats = vaultStatisticsRepository.findAllByVaultIdIn(vaultIds).associateBy { it.vaultId }

        val vaults = vaultIds.map { vaultId ->
            val persistedStat = persistedVaultStats[vaultId]
            val status = vaultStatusesById[vaultId]

            VaultDashboardDto(
                passwordsCount = persistedStat?.passwordsCount ?: 0,
                vaultName = status?.vaultName ?: vaultId.toString().take(VAULT_NAME_LENGTH),
                isOnline = status?.isOnline ?: false
            )
        }.sortedBy { it.vaultName }

        return DashboardResponseDto(
            passwordChart = chartData,
            recentActions = recentActions,
            vaults = vaults
        )
    }

    private fun fetchVaultStatuses(authorizationHeader: String): List<VaultStatusClientDto> {
        return runCatching {
            mossyPasswordRestClient.get()
                .uri("/passwords/vault/vaults")
                .header(HttpHeaders.AUTHORIZATION, authorizationHeader)
                .retrieve()
                .body<Array<VaultStatusClientDto>>()
                ?.toList()
                ?: emptyList()
        }.getOrElse {
            emptyList()
        }
    }

    private fun buildChart(from: Instant, vaultIds: Collection<UUID>): List<PasswordChartPointDto> {
        val events = passwordActionEventRepository.findByActionTypeFromAndVaultIds(ActionType.ADDED, from, vaultIds)
        val groupedByDay = events.groupBy {
            DAY_FORMATTER.format(it.eventTimestamp.atZone(ZoneOffset.UTC).toLocalDate())
        }

        return groupedByDay.entries
            .sortedBy { it.key }
            .map { (date, dayEvents) ->
                PasswordChartPointDto(
                    date = date,
                    addedCount = dayEvents.size.toLong()
                )
            }
    }

    companion object {
        private const val CHART_WINDOW_DAYS = 30L
        private const val DAY_SECONDS = 86_400L
        private const val VAULT_NAME_LENGTH = 8
        private val DAY_FORMATTER: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE
    }
}
