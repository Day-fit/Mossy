package pl.dayfit.mossydevicetrustshared.dto.request

import jakarta.validation.constraints.Pattern
import java.util.UUID

data class RegisterDeviceRequestDto(
    val userId: UUID,
    val osName: String,
    @field:Pattern(
        regexp = "^\\p{XDigit}{2}([-:])(?:\\p{XDigit}{2}\\1){4}\\p{XDigit}{2}$"
    )
    val mac: String,
    val publicIdentityKey: Map<String, Any>,
)