package pl.dayfit.mossydevicetrust.dto.request

import jakarta.validation.constraints.NotNull
import java.util.UUID

data class BlockDeviceRequestDto(
    @field:NotNull(message = "Target device id cannot be null")
    var targetDeviceId: UUID?
)
