package pl.dayfit.mossydevicetrust.dto.request

import java.util.UUID

data class ConfirmDeviceEnrollmentRequestDto(
    val enrollmentId: String,
    val challengeId: UUID,
    val signature: String,
) : Hashable
