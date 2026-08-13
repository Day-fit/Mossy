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
import pl.dayfit.mossyauth.type.AccessTokenType
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
import java.time.Duration
import java.util.Date
import java.util.UUID
import kotlin.concurrent.atomics.AtomicReference
import kotlin.concurrent.atomics.ExperimentalAtomicApi

/**
 * Service responsible for generating and signing JWT tokens with the currently active RSA key.
 *
 * Tokens are signed using RS256 and include user identity data, roles, and additional contextual
 * claims (such as device information or custom scopes).
 *
 * The signing key is populated asynchronously via [SecretRotatedEvent]. Until at least one key is
 * received, token generation methods throw [SigningKeyNotInitializedException].
 *
 * @property jwtConfigurationProperties Configuration containing access/refresh token lifetimes.
 */
@Service
@OptIn(ExperimentalAtomicApi::class)
class JwtGenerationService(
    private val jwtConfigurationProperties: JwtConfigurationProperties
) {
    /**
     * Currently active private RSA key used for signing JWTs.
     *
     * Stored in an atomic reference to guarantee safe replacement when key rotation events are
     * processed concurrently with token generation requests.
     */
    private val secretKey = AtomicReference<RSAKey?>(null)

    /**
     * Generates a standard token pair for a user:
     * - access token (short-lived)
     * - refresh token (long-lived)
     *
     * Both tokens include a `device_id` claim and share the same user identity claims.
     *
     * @param userDetails Authenticated user details used to populate identity/authorization claims.
     * @param deviceId Device identifier associated with the issued session/tokens.
     * @return Pair where:
     * - first: access token
     * - second: refresh token
     * @throws SigningKeyNotInitializedException when no signing key has been loaded yet.
     */
    fun generatePairOfTokens(userDetails: UserDetailsImpl, deviceId: UUID): TokenPairDto
    {
        return TokenPairDto(
            generate(
                userDetails,
                jwtConfigurationProperties.accessTokenExpirationTime,
                deviceId
            ),
            AccessTokenType.ACCESS_TOKEN,
            generate(
                userDetails,
                jwtConfigurationProperties.refreshTokenExpirationTime,
                deviceId,
            )
        )
    }

    /**
     * Generates a very short-lived token intended for device enrollment bootstrap flow.
     *
     * The token contains custom `scope` claims for enrollment operations and does not require
     * a device identifier claim.
     *
     * @param user Authenticated user initiating device enrollment.
     * @return Signed enrollment JWT.
     * @throws SigningKeyNotInitializedException when no signing key has been loaded yet.
     */
    fun generateDeviceEnrollmentToken(
        user: UserDetailsImpl,
    ): String {
        return generate(
            user,
            Duration.ofSeconds(30),
            customClaims = mapOf(
                "scope" to "device.enrollment.challenge device.enrollment.start"
            )
        )
    }

    /**
     * Builds and signs a JWT with base identity claims and optional contextual claims.
     *
     * Base claims:
     * - `sub` (user ID)
     * - `iss` (`mossy-auth`)
     * - `aud` (`mossy-user-api`)
     * - `iat`, `exp`
     * - `roles`, `preferred_username`, `email`
     *
     * Optional claims:
     * - `device_id` when [deviceId] is provided
     * - entries from [customClaims]
     *
     * Exactly one contextual source is required: either [deviceId] or [customClaims].
     *
     * @param user User whose data is embedded in token claims.
     * @param duration Token validity duration from issuance time.
     * @param deviceId Optional device identifier claim.
     * @param customClaims Optional additional claim map.
     * @return Serialized signed JWT.
     * @throws IllegalArgumentException if both [deviceId] and [customClaims] are missing.
     * @throws SigningKeyNotInitializedException when signing key is not yet available.
     */
    private fun generate(
        user: UserDetailsImpl,
        duration: Duration,
        deviceId: UUID? = null,
        customClaims: Map<String, Any>? = null,
    ): String
    {
        if (deviceId == null && customClaims.isNullOrEmpty()) {
            throw IllegalArgumentException("Either deviceId or customClaims must be set")
        }

        val secret = secretKey.load()
            ?: throw SigningKeyNotInitializedException("Secret key is not initialized yet.")

        val header: JWSHeader = JWSHeader.Builder(JWSAlgorithm.RS256)
            .keyID(secret.keyID)
            .build()

        val issuedAt = Date()
        val claimsBuilder = JWTClaimsSet.Builder()
            .jwtID(UUID.randomUUID().toString())
            .subject(user.userId.toString())
            .issuer("mossy-auth")
            .audience("mossy-user-api")
            .issueTime(issuedAt)
            .expirationTime(Date(issuedAt.time + duration.toMillis()))
            .claim("roles", user.authorities.map { it.authority })
            .claim("preferred_username", user.username)
            .claim("email", user.email)
            .claim("scope", "user.access")

        deviceId?.let {
            claimsBuilder.claim("device_id", it)
        }
        customClaims?.forEach { (name, value) ->
            claimsBuilder.claim(name, value)
        }

        val signedJwt = SignedJWT(
            header, claimsBuilder.build()
        )

        val signer = RSASSASigner(secret)
        signedJwt.sign(signer)

        return signedJwt.serialize()
    }

    /**
     * Handles key rotation events by atomically replacing the active signing key.
     *
     * All tokens generated after this method executes are signed with [SecretRotatedEvent.newSecret].
     *
     * @param event Event carrying the newly rotated RSA signing key.
     */
    @EventListener(SecretRotatedEvent::class)
    private fun updateSecretKey(event: SecretRotatedEvent)
    {
        secretKey.exchange(event.newSecret)
    }

    data class TokenPairDto(
        val accessToken: String,
        val accessTokenType: AccessTokenType,
        val refreshToken: String? = null,
    )
}