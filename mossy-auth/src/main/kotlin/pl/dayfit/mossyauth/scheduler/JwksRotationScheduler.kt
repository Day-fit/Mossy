package pl.dayfit.mossyauth.scheduler

import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.JWK
import com.nimbusds.jose.jwk.OctetKeyPair
import com.nimbusds.jose.jwk.gen.OctetKeyPairGenerator
import org.springframework.context.ApplicationEventPublisher
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate
import pl.dayfit.mossyauth.configuration.properties.JwtConfigurationProperties
import pl.dayfit.mossyauth.configuration.properties.MossyAuthConfigurationProperties
import pl.dayfit.mossyauth.event.SecretRotatedEvent
import pl.dayfit.mossyauth.exception.JwksServiceUnreachableException
import java.util.Date
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.concurrent.atomics.ExperimentalAtomicApi

@Service
@OptIn(ExperimentalAtomicApi::class)
class JwksRotationScheduler(
    private val starterJwksTemplate: RestTemplate,
    private val mossyAuthConfigurationProperties: MossyAuthConfigurationProperties,
    private val applicationEventPublisher: ApplicationEventPublisher,
    private val jwtConfigurationProperties: JwtConfigurationProperties
) {
    private val oneDayInMillis = 1000 * 60 * 60 * 24

    @Scheduled(fixedRate = 1, timeUnit = TimeUnit.DAYS)
    fun rotateJwks()
    {
        val now = Date()
        val refreshTokenLifetime = jwtConfigurationProperties.refreshTokenExpirationTime.toMillis()

        val octetKey: OctetKeyPair = OctetKeyPairGenerator(Curve.Ed25519)
            .keyID(UUID.randomUUID().toString())
            .issueTime(now)
            .expirationTime(Date(now.time + refreshTokenLifetime + oneDayInMillis))
            .generate()

        val jwk: JWK = octetKey.toPublicJWK()

        val headers = HttpHeaders()
        headers.contentType = MediaType.APPLICATION_JSON

        val entity = HttpEntity(jwk.toJSONString(), headers)

        //Synchronous call, RabbitMQ could lead to SPOF
        runCatching {
            starterJwksTemplate.put(
                mossyAuthConfigurationProperties.jwkUploadUrl,
                entity,
            )

            //loose coupling
            applicationEventPublisher.publishEvent(
                SecretRotatedEvent(octetKey)
            )
        }.onFailure {
            throw JwksServiceUnreachableException("Failed to rotate JWKS: ${it.message}")
        }
    }
}