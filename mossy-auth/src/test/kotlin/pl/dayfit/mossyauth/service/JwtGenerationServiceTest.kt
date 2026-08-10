package pl.dayfit.mossyauth.service

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.crypto.RSASSAVerifier
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator
import com.nimbusds.jwt.SignedJWT
import org.junit.jupiter.api.Test
import org.springframework.security.core.authority.SimpleGrantedAuthority
import pl.dayfit.mossyauth.configuration.properties.JwtConfigurationProperties
import pl.dayfit.mossyauth.event.SecretRotatedEvent
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
import java.time.Duration
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class JwtGenerationServiceTest {
    @Test
    fun `generated tokens use RS256 and include identity claims`() {
        val properties = JwtConfigurationProperties().apply {
            accessTokenExpirationTime = Duration.ofMinutes(5)
            refreshTokenExpirationTime = Duration.ofDays(1)
        }
        val service = JwtGenerationService(properties)
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
        service.javaClass.getDeclaredMethod("updateSecretKey", SecretRotatedEvent::class.java)
            .apply { isAccessible = true }
            .invoke(service, SecretRotatedEvent(signingKey))

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
        val service = JwtGenerationService(JwtConfigurationProperties())
        val signingKey = RSAKeyGenerator(2048).keyID("key-id").generate()
        val userId = UUID.randomUUID()
        val user = UserDetailsImpl(
            "alice",
            "password",
            userId,
            "alice@example.com",
            listOf(SimpleGrantedAuthority("USER"))
        )
        service.javaClass.getDeclaredMethod("updateSecretKey", SecretRotatedEvent::class.java)
            .apply { isAccessible = true }
            .invoke(service, SecretRotatedEvent(signingKey))

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
}
