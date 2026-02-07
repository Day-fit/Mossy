package pl.dayfit.mossyauthstarter.jwks

import com.nimbusds.jose.jwk.JWKSet
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Component
import org.springframework.web.client.RestTemplate
import org.springframework.web.client.getForEntity
import pl.dayfit.mossyauthstarter.configuration.properties.JwksConfigurationProperties
import java.net.URI
import java.time.Instant
import kotlin.concurrent.atomics.AtomicReference
import kotlin.concurrent.atomics.ExperimentalAtomicApi

@Component
@ConditionalOnProperty("mossy.jwks.jwks-provider-uri", matchIfMissing = false)
@OptIn(ExperimentalAtomicApi::class)
class StarterJwksProvider(
    private val jwksConfigurationProperties: JwksConfigurationProperties,
    private val starterJwksTemplate: RestTemplate
) : JwksProvider {
    private val jwkSet: AtomicReference<JWKSet?> = AtomicReference(null)
    private val lastRefreshTime: AtomicReference<Instant> = AtomicReference(Instant.MIN)
    private val logger = org.slf4j.LoggerFactory.getLogger(StarterJwksProvider::class.java)

    override fun getJwks(): JWKSet {
        return jwkSet.load() ?: refreshJwks()
    }

    /**
     * Refreshes the JSON Web Key Set (JWKS) by retrieving the latest key set from the configured
     * JWKS provider URI. If the provider cannot be reached or an error occurs during the
     * retrieval, it falls back to the cached JWKS. The refresh rate is controlled to prevent
     * excessive refresh attempts within a short period.
     *
     * @return the updated JWKS retrieved from the provider, or the cached version if the refresh failed
     * @throws IllegalStateException if neither the provider nor the cached JWKS can be accessed
     */
    @Synchronized
    override fun refreshJwks(): JWKSet {
        if (canRefresh().not())
        {
            logger.debug("JWKS refresh rate exceeded, skipping refresh.")
            return jwkSet.load() ?: throw IllegalStateException("Unable to fetch JWKS from provider")
        }

        val uri = URI(jwksConfigurationProperties.jwksProviderUri)
        val response: ResponseEntity<String> = starterJwksTemplate.getForEntity<String>(uri)

        if (response.statusCode.is2xxSuccessful.not()) {
            logger.warn("Unable to fetch JWKS from provider, using cached version.")
            return jwkSet.load() ?: throw IllegalStateException("Unable to fetch JWKS from provider")
        }

        logger.info("JWKS successfully refreshed.")
        val newJwkSet = JWKSet.parse(response.body)

        jwkSet.exchange(newJwkSet)
        lastRefreshTime.exchange(Instant.now())

        return newJwkSet
    }

    private fun canRefresh(): Boolean
    {
        val lastRefresh = lastRefreshTime.load()
        val maxRefreshRate = jwksConfigurationProperties.maxRefreshRate.toSeconds()

        return Instant.now()
            .isAfter(
                lastRefresh.plusSeconds(
                    maxRefreshRate
                )
            )
    }
}