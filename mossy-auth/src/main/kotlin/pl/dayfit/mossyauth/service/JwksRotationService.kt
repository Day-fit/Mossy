package pl.dayfit.mossyauth.service

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
import pl.dayfit.mossyauth.configuration.properties.MossyAuthConfigurationProperties
import pl.dayfit.mossyauth.event.SecretRotatedEvent
import pl.dayfit.mossyauth.exception.JwksServiceUnreachableException
import java.util.*
import java.util.concurrent.TimeUnit
import kotlin.concurrent.atomics.ExperimentalAtomicApi


@Service
@OptIn(ExperimentalAtomicApi::class)
class JwksRotationService(
    private val starterJwksTemplate: RestTemplate,
    private val mossyAuthConfigurationProperties: MossyAuthConfigurationProperties,
    private val applicationEventPublisher: ApplicationEventPublisher
) {
    @Scheduled(fixedRate = 1, timeUnit = TimeUnit.DAYS)
    fun rotateJwks()
    {
        val octetKey: OctetKeyPair = OctetKeyPairGenerator(Curve.Ed25519)
            .keyID(UUID.randomUUID().toString())
            .issueTime(Date())
            .expirationTime(Date(Date().time + TimeUnit.DAYS.toMillis(1)))
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