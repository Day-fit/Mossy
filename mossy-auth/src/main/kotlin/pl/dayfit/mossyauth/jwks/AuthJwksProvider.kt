package pl.dayfit.mossyauth.jwks

import com.nimbusds.jose.jwk.JWKSet
import org.springframework.stereotype.Component
import pl.dayfit.mossyauthstarter.jwks.JwksProvider

@Component
class AuthJwksProvider : JwksProvider {
    override fun getJwks(): JWKSet {
        TODO("Not yet implemented")
    }

    override fun refreshJwks(): JWKSet {
        TODO("Not yet implemented")
    }
}