package pl.dayfit.mossydeviceriskengine.service

import nl.basjes.parse.useragent.UserAgent
import nl.basjes.parse.useragent.UserAgentAnalyzer
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.stereotype.Service
import pl.dayfit.mossydeviceriskengine.model.DeviceEntry
import pl.dayfit.mossydeviceriskengineshared.messaging.AnaliseDeviceAuthRiskEvent

@Service
class DeviceAuthRiskEngineService(
    private val redisTemplate: RedisTemplate<String, MutableList<DeviceEntry>>,
    private val userAgentAnalyzer: UserAgentAnalyzer
) {
    companion object {
        const val KEY = "device-entry:%s"
    }

    private fun analyzeRisk(event: AnaliseDeviceAuthRiskEvent): Double {
        val key = KEY.format(event.deviceId)
        val entries = redisTemplate.opsForValue()
            .get(key)
            .orEmpty()
            .toMutableList()

        val headers = event.requestUserAgentHeaders
        val ua = userAgentAnalyzer.parse(headers)

        if (entries.isEmpty()) {
            val risk = .5 //No data, assume medium risk
            entries.add(
                DeviceEntry(
                    event.ip,
                    event.tlsJa3,
                    event.tlsJa4,
                    ua,
                    risk
                )
            )

            redisTemplate.opsForValue()
                .set(key, entries)

            return risk
        }

        var risk = 0.0

        val deviceClass = ua.get(UserAgent.DEVICE_CLASS).value
        val hintPlatform = headers["Sec-CH-UA-Platform-Version"]

        if (hintPlatform == null) {
            risk += .2
        } else {
            val normalizedUaPlatform = ua.get(UserAgent.OPERATING_SYSTEM_NAME)
                .value
                .split(" ")
                .first()

            if(hintPlatform == normalizedUaPlatform) {
                risk += 1
            }
        }

        if (deviceClass == "Hacker"  || deviceClass == "Robot") {
            risk += 1.0
        }

        if (ua.hasAmbiguity()) {
            risk += 1.0
        }

        if (ua.hasSyntaxError()) {
            risk += 1.0
        }

        if (event.tlsJa4.isBlank() || event.tlsJa3.isBlank() ) {
            risk += .2
        }

        if (!entries.all { it.ip == event.ip } ) {
            risk += .05
        }

        if (entries.any { it.userAgent != ua } ) {
            risk += .5
        }

        if (entries.none { it.tlsJa3 == event.tlsJa3 } ) {
            risk += .5
        }

        if (entries.none { it.tlsJa4 == event.tlsJa4 } ) {
            risk += .5
        }

        return risk
    }


    @RabbitListener(queues = ["device-auth-risk-analysis"])
    fun handleMessage(event: AnaliseDeviceAuthRiskEvent): Double {
        return analyzeRisk(event)
    }
}
