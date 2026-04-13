package pl.dayfit.mossypassword.exception

import java.util.UUID

class VaultNotFoundException(vaultId: UUID) : RuntimeException(
    "Vault with ID $vaultId does not exist"
)
