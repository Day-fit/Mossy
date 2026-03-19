package pl.dayfit.mossypassword.service.exception

import java.util.UUID

class VaultNotFoundException(vaultId: UUID) : RuntimeException(
    "Vault with ID $vaultId does not exist"
)
