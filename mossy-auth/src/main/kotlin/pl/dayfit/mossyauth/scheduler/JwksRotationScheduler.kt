package pl.dayfit.mossyauth.scheduler

import com.nimbusds.jose.jwk.RSAKey
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator
import org.slf4j.LoggerFactory
import org.springframework.context.ApplicationEventPublisher
import org.springframework.scheduling.TaskScheduler
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import pl.dayfit.mossyauth.configuration.properties.JwtConfigurationProperties
import pl.dayfit.mossyauth.event.SecretRotatedEvent
import pl.dayfit.mossyauth.exception.JwksRotationFailedException
import pl.dayfit.mossyauth.service.JwksService
import java.time.Duration
import java.time.Instant
import java.util.Date
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.concurrent.atomics.ExperimentalAtomicApi

@Service
@OptIn(ExperimentalAtomicApi::class)
/**
 * Rotates the RSA signing key and publishes its public half for resource servers.
 *
 * Public keys outlive refresh tokens by one day, allowing resource servers to
 * validate tokens issued immediately before a rotation.
 */
class JwksRotationScheduler(
    private val applicationEventPublisher: ApplicationEventPublisher,
    private val jwtConfigurationProperties: JwtConfigurationProperties,
    private val jwksService: JwksService,
    private val taskScheduler: TaskScheduler
) {
    private val oneDayInMillis = 1000 * 60 * 60 * 24
    private val logger = LoggerFactory.getLogger(this::class.java)

    /**
     * Generates a new 2048-bit RSA key, stores the public JWK, and broadcasts the
     * private key to in-process token signers. A failed rotation is retried once
     * after 30 seconds and then surfaces as [JwksRotationFailedException].
     */
    @Scheduled(fixedRate = 1, timeUnit = TimeUnit.DAYS)
    fun rotateJwks()
    {
        val now = Date()
        val refreshTokenLifetime = jwtConfigurationProperties.refreshTokenExpirationTime.toMillis()

        val kid = UUID.randomUUID().toString()
        val rsaKey: RSAKey = RSAKeyGenerator(2048)
            .keyID(kid)
            .issueTime(now)
            .expirationTime(Date(now.time + refreshTokenLifetime + oneDayInMillis))
            .generate()

        runCatching {
            jwksService.addJwkToSet(
                rsaKey.toPublicJWK()
            )

            logger.info("Jwks successfully added to jwks file. Key id {}", kid)

            //loose coupling
            applicationEventPublisher.publishEvent(
                SecretRotatedEvent(rsaKey)
            )
        }.onFailure {
            scheduleRetry()
            throw JwksRotationFailedException("Failed to rotate JWKS: ${it.message}", it)
        }
    }

    /** Schedules a short retry without blocking the scheduled-task thread. */
    private fun scheduleRetry()
    {
        taskScheduler.schedule(
            this::rotateJwks,
            Instant.now().plus(Duration.ofSeconds(30))
        )
    }
}
