package pl.dayfit.mossydevicetrustshared.dto.response

data class ForwardedErrorResponseDto(
    val forwardedMessage: String,
    val forwardedStatusCode: Int,
)
