package pl.dayfit.mossyauthstarter.service

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.crypto.Ed25519Verifier
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.stereotype.Service
import pl.dayfit.mossyauthstarter.jwks.JwksProvider
import java.util.UUID

@Service
class JwtClaimsService(
    private val jwksProvider: JwksProvider
) {
    /**
     * Extracts the UUID from the subject field contained within the claims of a JWT token.
     *
     * @param token the JSON Web Token (JWT) as a String
     * @return the UUID extracted from the subject field of the token's claims
     * @throws BadCredentialsException if the JWT is invalid, expired, has an unsupported algorithm,
     * or contains claims with an invalid issuer
     */
    fun getId(token: String): UUID = UUID.fromString(getClaims(token).subject)

    /**
     * Extracts the roles from a decoded JSON Web Token (JWT) and converts them into a collection
     * of granted authorities for Spring Security.
     *
     * @param token the JSON Web Token (JWT) as a String
     * @return a collection of granted authorities derived from the roles in the token's claims
     */
    fun getRoles(token: String): Collection<GrantedAuthority>
    {
        return getClaims(token).getStringListClaim("roles")
            .map { SimpleGrantedAuthority(it) }
    }

    /**
     * Extracts and validates the claims from a JWT token.
     *
     * @param token the JSON Web Token (JWT) as a String
     * @return a validated set of claims contained within the provided JWT
     * @throws BadCredentialsException if the JWT is invalid, expired, has an unsupported algorithm,
     * or contains claims with an invalid issuer
     */
    private fun getClaims(token: String): JWTClaimsSet
    {
        val signedJWT = runCatching { return@runCatching SignedJWT.parse(token) }
            .getOrElse { throw BadCredentialsException("Invalid JWT format") }

        if (signedJWT.header.algorithm != JWSAlgorithm.Ed25519)
        {
            throw BadCredentialsException("Unsupported algorithm")
        }

        val header = signedJWT.header
        var key = jwksProvider.getJwks()
            .getKeyByKeyId(header.keyID)

        if (key == null) {
            key = jwksProvider.refreshJwks()
                .getKeyByKeyId(header.keyID)
                ?: throw BadCredentialsException("No known key with ID ${header.keyID}")
        }

        val publicKey = key.toOctetKeyPair()

        val verifier = Ed25519Verifier(publicKey)

        if (!signedJWT.verify(verifier))
        {
            throw BadCredentialsException("Invalid JWT signature")
        }

        val claims = signedJWT.jwtClaimsSet
        validateClaims(claims)

        return signedJWT.jwtClaimsSet
    }

    private fun validateClaims(claimSet: JWTClaimsSet)
    {
        if (claimSet.expirationTime.before(java.util.Date())) throw BadCredentialsException("Token expired")
        if (claimSet.issuer != "mossy-auth") throw BadCredentialsException("Invalid issuer")
    }
}