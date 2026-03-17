package pl.dayfit.mossystatistics.service

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import pl.dayfit.mossystatistics.messaging.dto.PasswordStatisticEvent
import pl.dayfit.mossystatistics.model.ActionType
import pl.dayfit.mossystatistics.model.PasswordActionEvent
import pl.dayfit.mossystatistics.model.VaultStatistics
import pl.dayfit.mossystatistics.repository.PasswordActionEventRepository
import pl.dayfit.mossystatistics.repository.VaultStatisticsRepository
import java.time.Instant

@Service
class StatisticsAggregationService(
    private val passwordActionEventRepository: PasswordActionEventRepository,
    private val vaultStatisticsRepository: VaultStatisticsRepository
) {
    @Transactional
    fun consume(event: PasswordStatisticEvent) {
        val actionType = parseActionType(event.actionType) ?: return

        passwordActionEventRepository.save(
            PasswordActionEvent(
                vaultId = event.vaultId,
                passwordId = event.passwordId,
                domain = event.domain,
                actionType = actionType,
                eventTimestamp = event.eventTimestamp
            )
        )

        val vaultStatistics = vaultStatisticsRepository.findById(event.vaultId)
            .orElse(VaultStatistics(vaultId = event.vaultId))

        when (actionType) {
            ActionType.ADDED -> vaultStatistics.passwordsCount += 1
            ActionType.REMOVED -> vaultStatistics.passwordsCount = (vaultStatistics.passwordsCount - 1).coerceAtLeast(0)
            ActionType.UPDATED -> {}
        }

        vaultStatistics.lastUpdatedAt = Instant.now()
        vaultStatisticsRepository.save(vaultStatistics)
    }

    private fun parseActionType(rawActionType: String): ActionType? {
        return try {
            ActionType.valueOf(rawActionType.uppercase())
        } catch (exception: IllegalArgumentException) {
            null
        }
    }
}
