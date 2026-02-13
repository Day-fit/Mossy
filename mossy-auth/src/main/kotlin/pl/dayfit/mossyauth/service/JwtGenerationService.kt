package pl.dayfit.mossyauth.service

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.Ed25519Signer
import com.nimbusds.jose.jwk.OctetKeyPair
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Service
import pl.dayfit.mossyauth.event.SecretRotatedEvent
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
import java.util.Date
import java.util.concurrent.TimeUnit
import kotlin.concurrent.atomics.AtomicReference
import kotlin.concurrent.atomics.ExperimentalAtomicApi

@Service
@OptIn(ExperimentalAtomicApi::class)
class JwtGenerationService {
    private val secretKey = AtomicReference<OctetKeyPair?>(null)

    /**
     * Generates a pair of JWT tokens for the given user details. The first token has a shorter expiration
     * time (20 minutes), this is an access token. The second token has a longer expiration time
     * (1 day), this is a refresh token.
     *
     * @param userDetails The details of the user for whom the tokens are generated.
     * @return A pair of strings where the first element is the access token and the second element is the refresh token.
     */
    fun generatePairOfTokens(userDetails: UserDetailsImpl): Pair<String, String>
    {
        return Pair(
            generate(
                userDetails,
                20,
                TimeUnit.MINUTES
            ),
            generate(
                userDetails,
                1,
                TimeUnit.DAYS
            )
        )
    }

    fun generate(
        user: UserDetailsImpl,
        duration: Long,
        units: TimeUnit = TimeUnit.MINUTES
    ): String
    {
        val secret = secretKey.load() ?: throw IllegalStateException("Secret key is not initialized yet.")

        val header: JWSHeader = JWSHeader.Builder(JWSAlgorithm.Ed25519)
            .keyID(secret.keyID)
            .build()

        val claimSet: JWTClaimsSet = JWTClaimsSet.Builder()
            .subject(user.userId.toString())
            .issuer("mossy-auth")
            .issueTime(Date())
            .expirationTime(Date(Date().time + units.toMillis(duration)))
            .claim("roles", user.authorities.map { it.authority })
            .build()

        val signedJwt = SignedJWT(
            header, claimSet
        )

        val signer = Ed25519Signer(secret)
        signedJwt.sign(signer)

        return signedJwt.serialize()
    }

    @EventListener(SecretRotatedEvent::class)
    private fun updateSecretKey(event: SecretRotatedEvent)
    {
        secretKey.exchange(event.newSecret)
    }
}