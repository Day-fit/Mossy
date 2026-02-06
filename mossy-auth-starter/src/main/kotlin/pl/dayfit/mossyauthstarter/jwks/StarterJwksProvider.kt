package pl.dayfit.mossyauthstarter.jwks

import com.nimbusds.jose.jwk.JWKSet
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Component
import org.springframework.web.client.RestTemplate
import org.springframework.web.client.getForEntity
import pl.dayfit.mossyauthstarter.configuration.properties.JwksConfigurationProperties
import pl.dayfit.mossyauthstarter.event.JwksUpdatedEvent
import java.net.URI
import java.time.Duration
import java.time.Instant

@Component
@ConditionalOnProperty("mossy.jwks.jwks-provider-uri", matchIfMissing = false)
class StarterJwksProvider(
    private val jwksConfigurationProperties: JwksConfigurationProperties,
    private val starterJwksTemplate: RestTemplate
) : JwksProvider {
    private var jwkSet: JWKSet? = null
    private val logger = org.slf4j.LoggerFactory.getLogger(StarterJwksProvider::class.java)

    override fun getJwks(): JWKSet {
        return jwkSet ?: throw IllegalStateException("JWKS not initialized")
    }

    @RabbitListener(queues = [$$"jwks.queue.${mossy.service.name}"])
    fun updateJwks(event : JwksUpdatedEvent)
    {
        val uri = URI(jwksConfigurationProperties.jwksProviderUri)
        val response: ResponseEntity<String> = starterJwksTemplate.getForEntity<String>(uri)

        if (response.statusCode.is2xxSuccessful.not())
            throw IllegalStateException("Unable to fetch JWKS from provider")

        val delay = Duration.between(event.updatedAt, Instant.now()).toMillis()
        logger.info("Rotation successfully completed. Delay: $delay ms")
        jwkSet = JWKSet.parse(response.body)
    }
}