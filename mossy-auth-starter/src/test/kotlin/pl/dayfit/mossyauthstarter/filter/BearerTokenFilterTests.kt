package pl.dayfit.mossyauthstarter.filter

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.Ed25519Signer
import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.gen.OctetKeyPairGenerator
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.security.authentication.AuthenticationManager
import pl.dayfit.mossyauthstarter.auth.provider.JwtAuthenticationProvider
import pl.dayfit.mossyauthstarter.auth.token.JwtAuthenticationToken
import java.util.UUID
import kotlin.test.Test

@ExtendWith(MockitoExtension::class)
class BearerTokenFilterTests {
    private val jwtAuthenticationProvider: JwtAuthenticationProvider = mock()
    private val authenticationManager = AuthenticationManager { authentication ->
        jwtAuthenticationProvider.authenticate(authentication)
    }
    private val bearerTokenFilter = BearerTokenFilter(authenticationManager)

    @Test
    fun `test filter`() {
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

        jwtToken.sign(Ed25519Signer(keyPair))
        val request: HttpServletRequest = mock()
        val response: HttpServletResponse = mock()
        val filterChain: FilterChain = mock()

        whenever(request.getHeader("Authorization"))
            .thenReturn("Bearer ${jwtToken.serialize()}")

        whenever { jwtAuthenticationProvider.authenticate(any()) }
            .thenReturn(
                JwtAuthenticationToken(UUID.randomUUID(), listOf()))

        assertDoesNotThrow {
            bearerTokenFilter.doFilter(
                request, response, filterChain
            )
        }
    }
}