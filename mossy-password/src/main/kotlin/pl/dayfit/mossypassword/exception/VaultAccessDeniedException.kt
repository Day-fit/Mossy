package pl.dayfit.mossypassword.exception

import java.util.UUID

class VaultAccessDeniedException(vaultId: UUID) : RuntimeException(
    "Access to vault with ID $vaultId is forbidden"
)
