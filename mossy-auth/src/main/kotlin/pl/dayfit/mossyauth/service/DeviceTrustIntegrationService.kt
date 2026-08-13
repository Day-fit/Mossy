package pl.dayfit.mossyauth.service

import org.springframework.beans.factory.annotation.Value
import org.springframework.core.ParameterizedTypeReference
import org.springframework.http.HttpEntity
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.client.RestClientException
import org.springframework.web.client.RestTemplate
import org.springframework.web.client.getForEntity
import org.springframework.web.client.postForEntity
import pl.dayfit.mossyauth.exception.ForwardedClientErrorException
import pl.dayfit.mossyauth.exception.DownstreamServiceUnavailableException
import pl.dayfit.mossydevicetrustshared.dto.request.RegisterDeviceRequestDto
import pl.dayfit.mossydevicetrustshared.dto.request.VerifyNonceChallengeRequestDto
import pl.dayfit.mossydevicetrustshared.dto.response.GetIsBlockedResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.InternalResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.NonceChallengeResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.RegisterDeviceResponseDto
import java.util.UUID

@Service
class DeviceTrustIntegrationService(
    private val restTemplate: RestTemplate,

    @Value($$$"${mossy.integration.device-trust-service.host}")
    private val deviceTrustServiceHost: String
) {
    companion object {
        private const val REGISTER_DEVICE_ENDPOINT = "/api/v1/device-trust/internal/device"
        private const val CHECK_CHALLENGE_ENDPOINT = "/api/v1/device-trust/internal/nonce/challenge"
        private const val DEVICE_BLOCK_STATUS_ENDPOINT = "/api/v1/device-trust/internal/device/{deviceId}/block"
    }

    fun registerDevice(
        userId: UUID,
        publicIdentityKey: Map<String, Any>,
        userAgent: String,
        remoteAddr: String
    ): UUID {
        val response = restTemplate.postForEntity<RegisterDeviceResponseDto>(
            deviceTrustServiceHost + REGISTER_DEVICE_ENDPOINT,
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
        userId: UUID,
        challengeId: UUID,
        signature: String,
        userAgent: String,
        remoteAddr: String,
        deviceId: UUID
    ): NonceChallengeResponseDto {
        val request = VerifyNonceChallengeRequestDto(
            userId = userId,
            deviceId = deviceId,
            challengeId = challengeId,
            signature = signature,
            userAgent = userAgent,
            remoteAddr = remoteAddr,
        )

        val response = try {
            restTemplate.exchange(
                deviceTrustServiceHost + CHECK_CHALLENGE_ENDPOINT,
                HttpMethod.POST,
                HttpEntity(request),
                object : ParameterizedTypeReference<InternalResponseDto<NonceChallengeResponseDto>>() {},
            )
        } catch (_: RestClientException) {
            throw DownstreamServiceUnavailableException("Unable to check challenge")
        }

        if (response.statusCode != HttpStatus.OK) {
            throw DownstreamServiceUnavailableException("Unable to check challenge")
        }

        val body = response.body
            ?: throw DownstreamServiceUnavailableException("Unable to check challenge")

        body.forwardedError?.let { forwardedError ->
            if (forwardedError.forwardedStatusCode !in 400..499) {
                throw DownstreamServiceUnavailableException("Invalid forwarded status code")
            }
            throw ForwardedClientErrorException(forwardedError)
        }

        return body.result
            ?: throw DownstreamServiceUnavailableException("Missing challenge result")
    }

    fun getDeviceBlockStatus(deviceId: UUID): Boolean {
        val response = restTemplate.getForEntity<GetIsBlockedResponseDto>(
            deviceTrustServiceHost + DEVICE_BLOCK_STATUS_ENDPOINT,
            deviceId
        )

        if (response.statusCode == HttpStatus.NOT_FOUND) {
            throw NoSuchElementException("Device with id $deviceId does not exist")
        }

        val body = response.body
        if (response.statusCode != HttpStatus.OK || body == null) {
            throw DownstreamServiceUnavailableException("Unable to get device block status")
        }

        return body.isBlocked
    }
}
