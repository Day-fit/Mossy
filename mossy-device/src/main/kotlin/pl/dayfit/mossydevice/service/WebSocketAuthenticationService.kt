package pl.dayfit.mossydevice.service

import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.stereotype.Service
import pl.dayfit.mossydevice.ws.dto.WebSocketMessageDto
import pl.dayfit.mossydevice.ws.principal.DevicePrincipal
import java.util.UUID

@Service
class WebSocketAuthenticationService(
    private val jwtDecoder: JwtDecoder
) {
    fun authenticate(authFrame: WebSocketMessageDto.AuthFrame): AuthenticatedPeer {
        val jwt = jwtDecoder.decode(authFrame.accessToken)
        val principal = DevicePrincipal(
            deviceId = UUID.fromString(jwt.getClaimAsString("device_id")),
            userId = UUID.fromString(jwt.subject),
            publicDhKey = authFrame.jwkPublicDh
        )

        return AuthenticatedPeer(principal, authFrame.signature)
    }

    data class AuthenticatedPeer(
        val principal: DevicePrincipal,
        val signature: String
    )
}