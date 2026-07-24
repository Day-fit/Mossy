package pl.dayfit.mossyauth.service

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.RSASSASigner
import com.nimbusds.jose.jwk.RSAKey
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Service
import pl.dayfit.mossyauth.configuration.properties.JwtConfigurationProperties
import pl.dayfit.mossyauth.event.SecretRotatedEvent
import pl.dayfit.mossyauth.exception.SigningKeyNotInitializedException
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
import java.time.Duration
import java.util.Date
import java.util.UUID
import kotlin.concurrent.atomics.AtomicReference
import kotlin.concurrent.atomics.ExperimentalAtomicApi

@Service
@OptIn(ExperimentalAtomicApi::class)
/**
 * Issues RS256 JWTs for authenticated users using the currently rotated RSA key.
 *
 * The active signing key is supplied asynchronously by [SecretRotatedEvent]; token
 * generation is intentionally unavailable until the first key rotation completes.
 */
class JwtGenerationService(
    private val jwtConfigurationProperties: JwtConfigurationProperties
) {
    private val secretKey = AtomicReference<RSAKey?>(null)

    /**
     * Generates a pair of JWT tokens for the given user details. The first token has a shorter expiration
     * time (15 minutes by default), this is an access token. The second token has a longer expiration time
     * (14 days by default), this is a refresh token.
     *
     * @param userDetails The details of the user for whom the tokens are generated.
     * @return A pair of strings where the first element is the access token and the second element is the refresh token.
     */
    fun generatePairOfTokens(userDetails: UserDetailsImpl, deviceId: UUID): Pair<String, String>
    {
        return Pair(
            generate(
                userDetails,
                jwtConfigurationProperties.accessTokenExpirationTime,
                deviceId
            ),
            generate(
                userDetails,
                jwtConfigurationProperties.refreshTokenExpirationTime,
                deviceId
            )
        )
    }

    /**
     * Builds a signed token with the user UUID in `sub` and the claims consumed by
     * Mossy resource servers (`roles`, `preferred_username`, and `email`).
     */
    private fun generate(
        user: UserDetailsImpl,
        duration: Duration,
        deviceId: UUID
    ): String
    {
        val secret = secretKey.load()
            ?: throw SigningKeyNotInitializedException("Secret key is not initialized yet.")

        val header: JWSHeader = JWSHeader.Builder(JWSAlgorithm.RS256)
            .keyID(secret.keyID)
            .build()

        val claimSet: JWTClaimsSet = JWTClaimsSet.Builder()
            .subject(user.userId.toString())
            .issuer("mossy-auth")
            .audience("mossy-user-api")
            .issueTime(Date())
            .expirationTime(Date(Date().time + duration.toMillis()))
            .claim("roles", user.authorities.map { it.authority })
            .claim("preferred_username", user.username)
            .claim("email", user.email)
            .claim("device_id", deviceId)
            .build()

        val signedJwt = SignedJWT(
            header, claimSet
        )

        val signer = RSASSASigner(secret)
        signedJwt.sign(signer)

        return signedJwt.serialize()
    }

    /** Atomically swaps the private key used for all subsequently issued tokens. */
    @EventListener(SecretRotatedEvent::class)
    private fun updateSecretKey(event: SecretRotatedEvent)
    {
        secretKey.exchange(event.newSecret)
    }
}
