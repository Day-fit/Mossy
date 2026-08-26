package pl.dayfit.mossydevicetrustshared.dto.response

data class InternalResponseDto<T>(
    val result: T? = null,
    val forwardedError: ForwardedErrorResponseDto? = null,
)
