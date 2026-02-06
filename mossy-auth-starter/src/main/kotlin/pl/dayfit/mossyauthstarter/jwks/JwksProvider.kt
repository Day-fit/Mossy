package pl.dayfit.mossyauthstarter.jwks

import com.nimbusds.jose.jwk.JWKSet

interface JwksProvider {
    fun getJwks(): JWKSet
}