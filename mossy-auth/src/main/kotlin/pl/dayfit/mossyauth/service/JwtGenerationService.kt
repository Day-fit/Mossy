package pl.dayfit.mossyauth.service

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.RSASSASigner
import com.nimbusds.jose.jwk.RSAKey
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Service
import pl.dayfit.mossyauth.configuration.properties.JwtConfigurationProperties
import pl.dayfit.mossyauth.event.SecretKeyInitializedEvent
import pl.dayfit.mossyauth.event.SecretRotatedEvent
import pl.dayfit.mossyauth.exception.SigningKeyNotInitializedException
import pl.dayfit.mossyauth.type.AccessTokenType
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
import pl.dayfit.mossyauthstarter.type.AudienceType
import pl.dayfit.mossyauthstarter.type.UserTokenType
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
    private val jwtConfigurationProperties: JwtConfigurationProperties,
    private val applicationEventPublisher: ApplicationEventPublisher
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
            generateAccessToken(userDetails, deviceId),
            AccessTokenType.ACCESS_TOKEN,
            generateRefreshToken(userDetails.userId)
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
        val issuedAt = Date()
        val duration = jwtConfigurationProperties.deviceEnrollmentTokenExpirationTime

        val claimsBuilder = JWTClaimsSet.Builder()
            .jwtID(UUID.randomUUID().toString())
            .subject(user.userId.toString())
            .issuer("mossy-auth")
            .audience(AudienceType.MOSSY_USER_API.toString())
            .issueTime(issuedAt)
            .expirationTime(Date(issuedAt.time + duration.toMillis()))
            .claim("roles", user.authorities.map { it.authority })
            .claim("preferred_username", user.username)
            .claim("scope", "device.enrollment.challenge device.enrollment.start")
            .claim("type", UserTokenType.ACCESS_TOKEN)
            .build()

        return generateJwt(claimsBuilder)
    }

    fun generateCustomScopeAccessToken(scope: String): String {
        val issuedAt = Date()

        val claims = JWTClaimsSet.Builder()
            .jwtID(UUID.randomUUID().toString())
            .issuer("mossy-auth")
            .audience(AudienceType.MOSSY_INTERNAL_API.toString())
            .issueTime(issuedAt)
            .expirationTime(Date(issuedAt.time + 15 * 60 * 1000))
            .claim("scope", scope)
            .build()

        return generateJwt(
            claims
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
     * @param user User whose data is embedded in token claims.
     * @param deviceId Optional device identifier claim.
     * @return Serialized signed JWT.
     * @throws SigningKeyNotInitializedException when signing key is not yet available.
     */
    private fun generateAccessToken(
        user: UserDetailsImpl,
        deviceId: UUID,
    ): String {
        val issuedAt = Date()
        val duration = jwtConfigurationProperties.accessTokenExpirationTime

        val claimsBuilder = JWTClaimsSet.Builder()
            .jwtID(UUID.randomUUID().toString())
            .subject(user.userId.toString())
            .issuer("mossy-auth")
            .audience(AudienceType.MOSSY_USER_API.toString())
            .issueTime(issuedAt)
            .expirationTime(Date(issuedAt.time + duration.toMillis()))
            .claim("roles", user.authorities.map { it.authority })
            .claim("preferred_username", user.username)
            .claim("email", user.email)
            .claim("scope", "user.access")
            .claim("type", UserTokenType.ACCESS_TOKEN)

        deviceId.let {
            claimsBuilder.claim("device_id", it)
        }

        return generateJwt(claimsBuilder.build())
    }

    fun generateRefreshToken(userId: UUID): String {
        val duration = jwtConfigurationProperties.refreshTokenExpirationTime

        val claims = JWTClaimsSet.Builder()
            .jwtID(UUID.randomUUID().toString())
            .issuer(AudienceType.MOSSY_AUTH_API.toString())
            .audience("mossy-auth-api")
            .subject(userId.toString())
            .expirationTime(Date(Date().time + duration.toMillis()))
            .build()

        return generateJwt(claims)
    }

    /**
     * Signs and serializes an arbitrary JWT claims set with the active RSA key.
     *
     * Unlike [generateAccessToken], this method does not add, remove, or validate claims. Callers are
     * responsible for supplying all required claims, including token lifetime and intended scope.
     *
     * @param claims Claims to include in the token without modification.
     * @return Serialized signed JWT.
     * @throws SigningKeyNotInitializedException when signing key is not yet available.
     */
    private fun generateJwt(claims: JWTClaimsSet): String {
        val secret = secretKey.load()
            ?: throw SigningKeyNotInitializedException("Secret key is not initialized yet.")

        val header: JWSHeader = JWSHeader.Builder(JWSAlgorithm.RS256)
            .keyID(secret.keyID)
            .build()

        val signedJwt = SignedJWT(
            header, claims
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
        val oldValue = secretKey.exchange(event.newSecret)

        if (oldValue != null) {
            return
        }

        applicationEventPublisher.publishEvent(
            SecretKeyInitializedEvent()
        )
    }

    data class TokenPairDto(
        val accessToken: String,
        val accessTokenType: AccessTokenType,
        val refreshToken: String? = null,
    )
}
