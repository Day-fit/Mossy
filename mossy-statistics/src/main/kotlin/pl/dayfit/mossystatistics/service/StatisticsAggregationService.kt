package pl.dayfit.mossystatistics.service

import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import pl.dayfit.mossystatistics.messaging.dto.PasswordStatisticEvent
import pl.dayfit.mossystatistics.type.ActionType
import pl.dayfit.mossystatistics.model.PasswordActionEvent
import pl.dayfit.mossystatistics.model.VaultStatistics
import pl.dayfit.mossystatistics.repository.PasswordActionEventRepository
import pl.dayfit.mossystatistics.repository.VaultStatisticsRepository

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

        passwordActionEventRepository.save(
            PasswordActionEvent(
                vaultId = event.vaultId,
                actionId = event.actionId,
                passwordId = event.passwordId,
                domain = event.domain,
                actionType = actionType,
                eventTimestamp = event.eventTimestamp
            )
        )

        val vaultStatistics = vaultStatisticsRepository.findById(event.vaultId)
            .orElse(VaultStatistics(
                vaultId = event.vaultId,
                userId = event.userId,
            ))

        when (actionType) {
            ActionType.ADDED -> vaultStatistics.passwordsCount += 1
            ActionType.REMOVED -> vaultStatistics.passwordsCount = (vaultStatistics.passwordsCount - 1).coerceAtLeast(0)
            ActionType.UPDATED -> {}
        }

        vaultStatistics.lastSeenAt = event.eventTimestamp
        vaultStatisticsRepository.save(vaultStatistics)
    }
}
