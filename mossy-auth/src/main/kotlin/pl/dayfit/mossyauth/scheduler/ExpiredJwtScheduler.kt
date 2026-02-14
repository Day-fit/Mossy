package pl.dayfit.mossyauth.scheduler

import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import pl.dayfit.mossyauth.repository.RevokedJwtRepository
import java.time.Instant
import java.util.concurrent.TimeUnit

@Service
class ExpiredJwtScheduler(
    private val revokedJwtRepository: RevokedJwtRepository
) {
    private val logger = org.slf4j.LoggerFactory.getLogger(ExpiredJwtScheduler::class.java)

    @Scheduled(initialDelay = 30, fixedDelay = 30, timeUnit = TimeUnit.MINUTES)
    fun removeExpiredJwts()
    {
        val expiredTokens = revokedJwtRepository.findRevokedJwtModelByValidUntilAfter(Instant.now())
        revokedJwtRepository.deleteAll(expiredTokens)

        logger.info("Removed {} expired tokens", expiredTokens.size)
    }
}