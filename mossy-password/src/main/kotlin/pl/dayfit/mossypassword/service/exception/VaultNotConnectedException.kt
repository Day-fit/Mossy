package pl.dayfit.mossypassword.service.exception

import java.util.UUID

class VaultNotConnectedException(vaultId: UUID) : RuntimeException(
    "Vault with ID $vaultId is not connected"
)
