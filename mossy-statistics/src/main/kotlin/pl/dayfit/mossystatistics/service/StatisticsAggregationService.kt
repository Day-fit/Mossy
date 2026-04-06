package pl.dayfit.mossystatistics.service

import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import pl.dayfit.mossystatistics.messaging.dto.PasswordStatisticEvent
import pl.dayfit.mossystatistics.model.PasswordActionEvent
import pl.dayfit.mossystatistics.repository.PasswordActionEventRepository

@Service
class StatisticsAggregationService(
    private val passwordActionEventRepository: PasswordActionEventRepository
) {
    @Transactional
    @KafkaListener(topics = [$$"${mossy.kafka.topics.password-statistic.name}"])
    fun handlePasswordActionEvent(event: PasswordStatisticEvent) {
        if (passwordActionEventRepository.existsPasswordActionEventsByActionId(event.actionId)) return
        val actionType = event.actionType

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
