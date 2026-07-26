package pl.dayfit.mossydevice.service

import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import pl.dayfit.mossydevice.ws.dto.WebSocketMessageDto
import java.util.UUID
import kotlin.test.assertEquals

class WebSocketAuthenticationServiceTest {
    private val jwtDecoder: JwtDecoder = mock()
    private val service = WebSocketAuthenticationService(jwtDecoder)

    @Test
    fun `authenticate derives device claims from access token without validating peer signature`() {
        val deviceId = UUID.fromString("10000000-0000-0000-0000-000000000001")
        val userId = UUID.fromString("20000000-0000-0000-0000-000000000001")
        val publicDhKey = mapOf<String, Any>("kty" to "OKP", "crv" to "X25519", "x" to "dh-key")
        val frame = WebSocketMessageDto.AuthFrame("access-token", "peer-signature", publicDhKey)
        val jwt = mock<Jwt>()
        whenever(jwtDecoder.decode(frame.accessToken)).thenReturn(jwt)
        whenever(jwt.subject).thenReturn(userId.toString())
        whenever(jwt.getClaimAsString("device_id")).thenReturn(deviceId.toString())

        val peer = service.authenticate(frame)

        assertEquals(deviceId, peer.principal.deviceId)
        assertEquals(userId, peer.principal.userId)
        assertEquals(publicDhKey, peer.principal.publicDhKey)
        assertEquals("peer-signature", peer.signature)
    }
}
