package pl.dayfit.mossyauth.exception

import pl.dayfit.mossydevicetrustshared.dto.response.ForwardedErrorResponseDto

class ForwardedClientErrorException(
    val forwardedError: ForwardedErrorResponseDto,
) : RuntimeException(forwardedError.forwardedMessage)
