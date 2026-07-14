package pl.dayfit.mossyauth.service

import com.nimbusds.jose.jwk.JWK
import com.nimbusds.jose.jwk.JWKMatcher
import com.nimbusds.jose.jwk.JWKSet
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import tools.jackson.databind.json.JsonMapper
import java.io.File
import java.text.ParseException
import java.util.Date

@Service
class JwksService(
    private val jsonMapper: JsonMapper,
    @Value($$"${mossy.jwks.path:/app/data/jwks.json}")
    private val jwksPath: String,
) {
    private val logger = LoggerFactory.getLogger(this::class.java)
    private val jwksFile = File(jwksPath)


    /**
     * Adds a JWK to the persisted JWKS file.
     *
     * Creates the file if it does not exist, keeps only non-expired keys,
     * and recreates the file if the existing content cannot be parsed.
     */
    fun addJwkToSet(jwk: JWK) {
        if (jwksFile.exists().not()) {
            jwksFile.createNewFile()
            saveJwksToFile(JWKSet(jwk))
        }

        jwksFile.bufferedReader().use { reader ->
            val text = reader.readText()

            try {
                val newSet: JWKSet = if (text.isBlank()) JWKSet(jwk)
                else JWKSet(JWKSet.parse(text).keys
                    .filter { it.expirationTime.after(Date()) }
                    .toMutableList()
                    .apply {
                        add(jwk)
                    })

                saveJwksToFile(newSet)
            } catch (_: ParseException) {
                logger.warn("Error while parsing jwks.json, removing file and saving new key.")

                jwksFile.delete()
                jwksFile.createNewFile()
                saveJwksToFile(JWKSet(jwk))

                logger.warn("Successfully deleted file and saved new key.")
            }
        }
    }

    fun getJwks(): Map<String, Any> {
        if (jwksFile.exists().not()) {
            jwksFile.createNewFile()
            saveJwksToFile(JWKSet())
        }

        var jwks: JWKSet? = null
        jwksFile.bufferedReader().use { reader ->
            jwks = JWKSet.parse(
                reader.readText()
            )
        }

        return jwks?.toJSONObject()
            ?: emptyMap()
    }

    private fun saveJwksToFile(jwks: JWKSet) {
        val json = jsonMapper.writeValueAsString(jwks.toJSONObject())

        jwksFile.bufferedWriter().use { writer ->
            writer.write(json)
        }
    }
}