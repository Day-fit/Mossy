package pl.dayfit.mossyauth.service

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.crypto.RSASSAVerifier
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator
import com.nimbusds.jwt.SignedJWT
import org.junit.jupiter.api.Test
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoMoreInteractions
import org.springframework.context.ApplicationEventPublisher
import org.springframework.security.core.authority.SimpleGrantedAuthority
import pl.dayfit.mossyauth.configuration.properties.JwtConfigurationProperties
import pl.dayfit.mossyauth.event.SecretKeyInitializedEvent
import pl.dayfit.mossyauth.event.SecretRotatedEvent
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
import java.time.Duration
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class JwtGenerationServiceTest {
    private val applicationEventPublisher: ApplicationEventPublisher = mock()

    @Test
    fun `custom scope access token is signed and contains internal service claims`() {
        val service = JwtGenerationService(JwtConfigurationProperties(), applicationEventPublisher)
        val signingKey = RSAKeyGenerator(2048).keyID("key-id").generate()
        setSigningKey(service, signingKey)

        val token = SignedJWT.parse(service.generateCustomScopeAccessToken("device.trust.internal"))
        val claims = token.jwtClaimsSet

        assertTrue(token.verify(RSASSAVerifier(signingKey.toRSAPublicKey())))
        assertEquals(JWSAlgorithm.RS256, token.header.algorithm)
        assertEquals("key-id", token.header.keyID)
        assertEquals("mossy-auth", claims.issuer)
        assertEquals(listOf("mossy-internal-api"), claims.audience)
        assertEquals("device.trust.internal", claims.getStringClaim("scope"))
        assertEquals(15 * 60, Duration.between(claims.issueTime.toInstant(), claims.expirationTime.toInstant()).seconds)
        assertTrue(claims.expirationTime.toInstant().isAfter(Instant.now()))
        assertNull(claims.subject)
        assertNull(claims.getClaim("roles"))
    }

    @Test
    fun `first signing key publishes initialization event only once`() {
        val service = JwtGenerationService(JwtConfigurationProperties(), applicationEventPublisher)

        setSigningKey(service, RSAKeyGenerator(2048).keyID("first-key").generate())

        val eventCaptor = argumentCaptor<SecretKeyInitializedEvent>()
        verify(applicationEventPublisher).publishEvent(eventCaptor.capture())

        setSigningKey(service, RSAKeyGenerator(2048).keyID("rotated-key").generate())
        verifyNoMoreInteractions(applicationEventPublisher)
    }

    @Test
    fun `generated tokens use RS256 and include identity claims`() {
        val properties = JwtConfigurationProperties().apply {
            accessTokenExpirationTime = Duration.ofMinutes(5)
            refreshTokenExpirationTime = Duration.ofDays(1)
        }
        val service = JwtGenerationService(properties, applicationEventPublisher)
        val signingKey = RSAKeyGenerator(2048).keyID("key-id").generate()
        val userId = UUID.randomUUID()
        val user = UserDetailsImpl(
            "alice",
            "password",
            userId,
            "alice@example.com",
            listOf(SimpleGrantedAuthority("USER"))
        )
        val deviceId = UUID.randomUUID()
        setSigningKey(service, signingKey)

        val accessToken = SignedJWT.parse(service.generatePairOfTokens(user, deviceId).accessToken)

        assertEquals(JWSAlgorithm.RS256, accessToken.header.algorithm)
        assertEquals("key-id", accessToken.header.keyID)
        assertTrue(accessToken.verify(RSASSAVerifier(signingKey.toRSAPublicKey())))
        assertEquals(userId.toString(), accessToken.jwtClaimsSet.subject)
        assertEquals("alice", accessToken.jwtClaimsSet.getStringClaim("preferred_username"))
        assertEquals("alice@example.com", accessToken.jwtClaimsSet.getStringClaim("email"))
        assertEquals(deviceId.toString(), accessToken.jwtClaimsSet.getStringClaim("device_id"))
        assertEquals(listOf("USER"), accessToken.jwtClaimsSet.getStringListClaim("roles"))
    }

    @Test
    fun `device enrollment token is short lived and contains enrollment scopes`() {
        val service = JwtGenerationService(JwtConfigurationProperties(), applicationEventPublisher)
        val signingKey = RSAKeyGenerator(2048).keyID("key-id").generate()
        val userId = UUID.randomUUID()
        val user = UserDetailsImpl(
            "alice",
            "password",
            userId,
            "alice@example.com",
            listOf(SimpleGrantedAuthority("USER"))
        )
        setSigningKey(service, signingKey)

        val token = SignedJWT.parse(service.generateDeviceEnrollmentToken(user))
        val claims = token.jwtClaimsSet

        assertTrue(token.verify(RSASSAVerifier(signingKey.toRSAPublicKey())))
        assertEquals(userId.toString(), claims.subject)
        assertEquals(
            setOf("device.enrollment.start", "device.enrollment.challenge"),
            claims.getStringClaim("scope").split(' ').toSet(),
        )
        assertNull(claims.getClaim("device_id"))
        assertEquals(30, Duration.between(claims.issueTime.toInstant(), claims.expirationTime.toInstant()).seconds)
        assertTrue(claims.expirationTime.toInstant().isAfter(Instant.now()))
    }

    private fun setSigningKey(service: JwtGenerationService, signingKey: com.nimbusds.jose.jwk.RSAKey) {
        service.javaClass.getDeclaredMethod("updateSecretKey", SecretRotatedEvent::class.java)
            .apply { isAccessible = true }
            .invoke(service, SecretRotatedEvent(signingKey))
    }
}
