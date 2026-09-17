package pl.dayfit.mossystatistics.service

import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import pl.dayfit.mossystatistics.messaging.dto.PasswordStatisticEvent
import pl.dayfit.mossystatistics.model.PasswordActionEvent
import pl.dayfit.mossystatistics.model.VaultStatistics
import pl.dayfit.mossystatistics.repository.PasswordActionEventRepository
import pl.dayfit.mossystatistics.repository.VaultStatisticsRepository
import pl.dayfit.mossystatistics.type.ActionType

@Service
class StatisticsAggregationService(
    private val passwordActionEventRepository: PasswordActionEventRepository,
    private val vaultStatisticsRepository: VaultStatisticsRepository,
) {
    @Transactional
    @KafkaListener(topics = [$$"${mossy.kafka.topics.password-statistic.name}"])
    fun handlePasswordActionEvent(event: PasswordStatisticEvent) {
        if (passwordActionEventRepository.existsPasswordActionEventsByActionId(event.actionId)) return
        val actionType = event.actionType

        if (actionType != ActionType.UPDATED) {
            val vaultStatistics = vaultStatisticsRepository.findById(event.vaultId).orElseGet {
                VaultStatistics(vaultId = event.vaultId, userId = event.userId)
            }
            vaultStatistics.passwordsCount = when (actionType) {
                ActionType.ADDED -> vaultStatistics.passwordsCount + 1
                ActionType.REMOVED -> maxOf(0, vaultStatistics.passwordsCount - 1)
                else -> vaultStatistics.passwordsCount
            }
            vaultStatisticsRepository.save(vaultStatistics)
        }

        passwordActionEventRepository.save(
            PasswordActionEvent(
                actionId = event.actionId,
                passwordId = event.passwordId,
                domain = event.domain,
                actionType = actionType,
                eventTimestamp = event.eventTimestamp,
                vaultId = event.vaultId,
                userId = event.userId
            )
        )
    }
}
