package pl.dayfit.mossyauth.service

import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate
import org.springframework.web.client.postForEntity
import pl.dayfit.mossyauth.exception.DownstreamServiceUnavailableException
import pl.dayfit.mossydevicetrustshared.dto.request.NonceChallengeRequestDto
import pl.dayfit.mossydevicetrustshared.dto.request.RegisterDeviceRequestDto
import pl.dayfit.mossydevicetrustshared.dto.response.NonceChallengeResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.RegisterDeviceResponseDto
import java.util.UUID

@Service
class DeviceTrustIntegrationService(
    private val restTemplate: RestTemplate,

    @Value($$$"${mossy.integration.device-trust-service.host}")
    private val trustServiceHost: String
) {
    companion object {
        private const val REGISTER_DEVICE_ENDPOINT = "/api/v1/device-trust/device"
        private const val CHECK_CHALLENGE_ENDPOINT = "/api/v1/device-trust/nonce/challenge"
    }

    fun registerDevice(
        userId: UUID,
        publicIdentityKey: Map<String, Any>,
        userAgent: String,
        remoteAddr: String
    ): UUID {
        val response = restTemplate.postForEntity<RegisterDeviceResponseDto>(
            trustServiceHost + REGISTER_DEVICE_ENDPOINT,
            RegisterDeviceRequestDto(
                userId,
                userAgent,
                remoteAddr,
                publicIdentityKey
            )
        )

        val body = response.body
        if (response.statusCode != HttpStatus.OK || body == null) {
            throw DownstreamServiceUnavailableException("Unable to register device")
        }

        return body.deviceId
    }

    fun checkChallenge(
        challengeId: UUID,
        signature: String,
        os: String,
        remoteAddr: String,
        deviceId: UUID
    ): NonceChallengeResponseDto {
        val response = restTemplate.postForEntity<NonceChallengeResponseDto>(
            trustServiceHost + CHECK_CHALLENGE_ENDPOINT,
            NonceChallengeRequestDto(
                challengeId,
                signature,
                os,
                remoteAddr,
                deviceId
            )
        )

        val body = response.body
        if (response.statusCode != HttpStatus.OK || body == null) {
            throw DownstreamServiceUnavailableException("Unable to check device challenge")
        }

        return body
    }
}
