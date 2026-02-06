package pl.dayfit.mossyauthstarter.service

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
    fun getId(token: String): UUID = UUID.fromString(getClaims(token).subject)
    fun getRoles(token: String): Collection<GrantedAuthority>
    {
        return getClaims(token).getStringListClaim("roles")
            .map { SimpleGrantedAuthority(it) }
    }

    private fun getClaims(token: String): JWTClaimsSet
    {
        val signedJWT = SignedJWT.parse(token)
        val header = signedJWT.header
        val publicKey = jwksProvider.getJwks()
            .getKeyByKeyId(header.keyID)
            .toOctetKeyPair()

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
        if (claimSet.issuer != "aurora-auth") throw BadCredentialsException("Invalid issuer")
    }
}