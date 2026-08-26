package pl.dayfit.mossyauth.dto.response

import pl.dayfit.mossyauth.type.AccessTokenType

data class LoginResponseDto (
    val accessToken: String,
    val accessTokenType: AccessTokenType,
)