package pl.dayfit.mossyauthstarter.service

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.Ed25519Signer
import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.gen.OctetKeyPairGenerator
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.whenever
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.security.core.authority.SimpleGrantedAuthority
import pl.dayfit.mossyauthstarter.jwks.StarterJwksProvider
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertTrue

@ExtendWith(MockitoExtension::class)
class JwtClaimsServiceTests {
    private val starterJwksProvider: StarterJwksProvider = mock()
    private val jwtClaimsService = JwtClaimsService(starterJwksProvider)

    @Test
    fun `test get uuid from token`() {
        val keyPair = OctetKeyPairGenerator(Curve.Ed25519)
            .keyID("test-key")
            .generate()

        val id = UUID.randomUUID()
        val claims = JWTClaimsSet.Builder()
            .subject(id.toString())
            .issuer("mossy-auth")
            .expirationTime(java.util.Date(System.currentTimeMillis() + 10000))
            .claim("roles", listOf("USER"))
            .build()

        val jwtToken = SignedJWT(
            JWSHeader.Builder(JWSAlgorithm.Ed25519)
                .keyID(keyPair.keyID)
                .build(),
            claims
        )

        whenever {
            starterJwksProvider.getJwks()
        }.thenReturn(JWKSet(keyPair.toPublicJWK()))

        jwtToken.sign(Ed25519Signer(keyPair))

        assertTrue { id == jwtClaimsService.getId(jwtToken.serialize()) }
    }

    @Test
    fun `test get roles from token`() {
        val keyPair = OctetKeyPairGenerator(Curve.Ed25519)
            .keyID("test-key")
            .generate()

        val roles = listOf("USER", "ADMIN")
        val claims = JWTClaimsSet.Builder()
            .subject(UUID.randomUUID().toString())
            .issuer("mossy-auth")
            .expirationTime(java.util.Date(System.currentTimeMillis() + 10000))
            .claim("roles", roles)
            .build()

        val jwtToken = SignedJWT(
            JWSHeader.Builder(JWSAlgorithm.Ed25519)
                .keyID(keyPair.keyID)
                .build(),
            claims
        )

        whenever {
            starterJwksProvider.getJwks()
        }.thenReturn(JWKSet(keyPair.toPublicJWK()))

        jwtToken.sign(Ed25519Signer(keyPair))

        assertContentEquals(roles.map { SimpleGrantedAuthority(it) }, jwtClaimsService.getRoles(jwtToken.serialize()))
    }

    @Test
    fun `test expired token throws exception`()
    {
        val keyPair = OctetKeyPairGenerator(Curve.Ed25519)
            .keyID("test-key")
            .generate()

        val claims = JWTClaimsSet.Builder()
            .subject(UUID.randomUUID().toString())
            .issuer("mossy-auth")
            .expirationTime(java.util.Date(System.currentTimeMillis() - 10000))
            .claim("roles", listOf("USER"))
            .build()

        val jwtToken = SignedJWT(
            JWSHeader.Builder(JWSAlgorithm.Ed25519)
                .keyID(keyPair.keyID)
                .build(),
            claims
        )

        whenever {
            starterJwksProvider.getJwks()
        }.thenReturn(JWKSet(keyPair.toPublicJWK()))

        jwtToken.sign(Ed25519Signer(keyPair))
        val serializedToken = jwtToken.serialize()

        assertThrows<BadCredentialsException> { jwtClaimsService.getId(serializedToken) }
        assertThrows<BadCredentialsException> { jwtClaimsService.getRoles(serializedToken) }
    }

    @Test
    fun `test wrong issuer throws exception`()
    {
        val keyPair = OctetKeyPairGenerator(Curve.Ed25519)
            .keyID("test-key")
            .generate()

        val claims = JWTClaimsSet.Builder()
            .subject(UUID.randomUUID().toString())
            .issuer("wrong-issuer")
            .expirationTime(java.util.Date(System.currentTimeMillis() - 10000))
            .claim("roles", listOf("USER"))
            .build()

        val jwtToken = SignedJWT(
            JWSHeader.Builder(JWSAlgorithm.Ed25519)
                .keyID(keyPair.keyID)
                .build(),
            claims
        )

        whenever {
            starterJwksProvider.getJwks()
        }.thenReturn(JWKSet(keyPair.toPublicJWK()))

        jwtToken.sign(Ed25519Signer(keyPair))
        val serializedToken = jwtToken.serialize()

        assertThrows<BadCredentialsException> { jwtClaimsService.getId(serializedToken) }
        assertThrows<BadCredentialsException> { jwtClaimsService.getRoles(serializedToken) }
    }
}