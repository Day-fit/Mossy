package pl.dayfit.mossyauth.service

import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import tools.jackson.databind.json.JsonMapper
import java.nio.file.Path
import kotlin.io.path.readText
import kotlin.test.assertEquals

class JwksServiceTest {
    @TempDir
    lateinit var tempDir: Path

    @Test
    fun `adding first key persists it once`() {
        val jwksPath = tempDir.resolve("jwks.json")
        val service = JwksService(JsonMapper.builder().build(), jwksPath.toString())
        val key = RSAKeyGenerator(2048).keyID("first-key").generate().toPublicJWK()

        service.addJwkToSet(key)

        val keys = JWKSet.parse(jwksPath.readText()).keys
        assertEquals(listOf("first-key"), keys.map { it.keyID })
    }
}
