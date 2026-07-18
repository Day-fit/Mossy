package pl.dayfit.mossydevicetrust.helper

import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.OctetKeyPair
import com.nimbusds.jose.jwk.gen.OctetKeyPairGenerator

object KeygenHelper {
    fun generateKeyPair(curve: Curve = Curve.Ed25519): OctetKeyPair {
        return OctetKeyPairGenerator(curve)
            .generate()
    }
}