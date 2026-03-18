package pl.dayfit.mossypassword.service.exception

import java.util.UUID

class VaultAccessDeniedException(vaultId: UUID) : RuntimeException(
    "Access to vault with ID $vaultId is forbidden"
)
