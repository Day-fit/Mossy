package pl.dayfit.mossyauthstarter.configuration

import com.nimbusds.jose.JOSEObjectType
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.RSASSASigner
import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import com.sun.net.httpserver.HttpServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtException
import java.net.InetSocketAddress
import java.time.Instant
import java.util.Date
import kotlin.test.assertEquals

class JwtDecoderConfigurationTest {
    private val signingKey = RSAKeyGenerator(2048).keyID("test-key").generate()
    private lateinit var server: HttpServer
    private lateinit var decoder: JwtDecoder

    @BeforeEach
    fun serveSigningKey() {
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/jwks") { exchange ->
            val body = JWKSet(signingKey.toPublicJWK()).toString().toByteArray()
            exchange.responseHeaders.add("Content-Type", "application/json")
            exchange.sendResponseHeaders(200, body.size.toLong())
            exchange.responseBody.use { it.write(body) }
        }
        server.start()
        decoder = JwtDecoderConfiguration().jwtDecoder("http://127.0.0.1:${server.address.port}/jwks")
    }

    @AfterEach
    fun stopServer() {
        server.stop(0)
    }

    @ParameterizedTest
    @CsvSource(
        "at+jwt, MOSSY_USER_API",
        "at+jwt, MOSSY_INTERNAL_API",
        "application/at+jwt, MOSSY_USER_API",
    )
    fun `API decoder accepts access tokens`(type: String, audience: String) {
        assertEquals("alice", decoder.decode(signedToken(type, audience)).subject)
    }

    @ParameterizedTest
    @CsvSource(
        "JWT, MOSSY_AUTH_API",
        "at+jwt, MOSSY_AUTH_API",
        "JWT, MOSSY_USER_API",
        ", MOSSY_USER_API",
        "at+jwt, unknown",
        "at+jwt,",
    )
    fun `API decoder rejects invalid type or audience`(type: String?, audience: String?) {
        assertThrows<JwtException> { decoder.decode(signedToken(type, audience)) }
    }

    private fun signedToken(type: String?, audience: String?): String {
        val header = JWSHeader.Builder(JWSAlgorithm.RS256).keyID(signingKey.keyID)
        if (type != null) header.type(JOSEObjectType(type))
        val claims = JWTClaimsSet.Builder()
            .issuer("mossy-auth")
            .subject("alice")
            .audience(audience)
            .expirationTime(Date.from(Instant.now().plusSeconds(120)))
            .build()
        return SignedJWT(header.build(), claims).apply {
            sign(RSASSASigner(signingKey))
        }.serialize()
    }
}
