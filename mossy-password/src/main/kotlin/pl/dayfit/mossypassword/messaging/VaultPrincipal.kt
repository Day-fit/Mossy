package pl.dayfit.mossypassword.messaging

import java.security.Principal

class VaultPrincipal(
    private val vaultId: String
) : Principal {
    override fun getName(): String {
        return vaultId
    }
}