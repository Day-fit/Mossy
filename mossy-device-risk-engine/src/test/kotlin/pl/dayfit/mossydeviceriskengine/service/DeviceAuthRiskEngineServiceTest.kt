package pl.dayfit.mossydeviceriskengine.service

import nl.basjes.parse.useragent.UserAgentAnalyzer
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Named.named
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource
import org.mockito.Answers
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.whenever
import org.springframework.data.redis.core.RedisTemplate
import pl.dayfit.mossydeviceriskengine.model.DeviceEntry
import pl.dayfit.mossydeviceriskengineshared.messaging.AnaliseDeviceAuthRiskEvent
import java.util.stream.Stream
import kotlin.test.assertTrue

@ExtendWith(MockitoExtension::class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DeviceAuthRiskEngineServiceTest {
    @Mock(answer = Answers.RETURNS_DEEP_STUBS)
    private lateinit var redisTemplate: RedisTemplate<String, MutableList<DeviceEntry>>
    private val userAgentAnalyzer = UserAgentAnalyzer.newBuilder().withCache(300).build()
    private lateinit var deviceAuthRiskEngineService: DeviceAuthRiskEngineService

    @BeforeEach
    fun setUp() {
        deviceAuthRiskEngineService = DeviceAuthRiskEngineService(redisTemplate, userAgentAnalyzer)
    }

    @Disabled("Risk scoring is not implemented yet")
    @ParameterizedTest
    @MethodSource("deviceEntries")
    fun `returns high risk score for suspicious device`(
        deviceEntry: MutableList<DeviceEntry>,
        event: AnaliseDeviceAuthRiskEvent
    ) {
        whenever(redisTemplate.opsForValue().get("device-entry:" + event.deviceId))
            .thenReturn(deviceEntry)

        val result = deviceAuthRiskEngineService.handleMessage(event)
        print(result)

        assertTrue(result > 0.6)
    }

    fun deviceEntries(): Stream<Arguments> {
        val knownHeaders = mapOf(
            "User-Agent" to "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            "Sec-CH-UA" to "\"Chromium\";v=\"130\"",
            "Sec-CH-UA-Platform" to "\"Windows\"",
            "Sec-CH-UA-Mobile" to "?0",
        )
        val knownDevice = DeviceEntry(
            ip = "192.0.2.10",
            tlsJa3 = "e7d705a3286e19ea42f587b344ee6865",
            tlsJa4 = "t13d1516h2_8daaf6152771_02713d6af862",
            userAgent = userAgentAnalyzer.parse(knownHeaders),
            riskScore = 0.05,
        )
        val usualLogin = AnaliseDeviceAuthRiskEvent(
            deviceId = "device-001",
            ip = knownDevice.ip,
            requestUserAgentHeaders = knownHeaders,
            tlsJa3 = knownDevice.tlsJa3,
            tlsJa4 = knownDevice.tlsJa4,
        )
        val differentTlsLogin = usualLogin.copy(
            tlsJa3 = "4d7a28d6f2263ed61de88ca66eb011e3",
            tlsJa4 = "t13d1516h2_2b729b4bf6f3_9e7b989ebec8",
        )
        val mobileLogin = differentTlsLogin.copy(
            ip = "203.0.113.20",
            requestUserAgentHeaders = mapOf(
                "User-Agent" to "Mozilla/5.0 (Linux; Android 14; Pixel 8) " +
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
                "Sec-CH-UA" to "\"Chromium\";v=\"130\"",
                "Sec-CH-UA-Platform" to "\"Android\"",
                "Sec-CH-UA-Mobile" to "?1",
            ),
        )

        fun scenario(
            name: String,
            event: AnaliseDeviceAuthRiskEvent,
            history: List<DeviceEntry> = listOf(knownDevice),
        ): Arguments = Arguments.of(named(name, history.toMutableList()), event)

        return Stream.of(
            scenario(
                "Both TLS fingerprints changed while the browser identity stayed the same",
                differentTlsLogin,
            ),
            scenario(
                "Windows desktop User-Agent conflicts with Android mobile Client Hints",
                usualLogin.copy(
                    requestUserAgentHeaders = mobileLogin.requestUserAgentHeaders +
                        ("User-Agent" to knownHeaders.getValue("User-Agent")),
                ),
            ),
            scenario(
                "New IP address and TLS fingerprints for an existing device ID",
                differentTlsLogin.copy(ip = "198.51.100.25"),
            ),
            scenario(
                "Known browser device ID reused by an automated HTTP client",
                differentTlsLogin.copy(
                    ip = "203.0.113.30",
                    requestUserAgentHeaders = mapOf("User-Agent" to "python-requests/2.32.3"),
                ),
            ),
            scenario(
                "New IP address with missing browser and TLS identification",
                usualLogin.copy(
                    ip = "198.51.100.40",
                    requestUserAgentHeaders = emptyMap(),
                    tlsJa3 = "",
                    tlsJa4 = "",
                ),
            ),
            scenario(
                "Previously high-risk device returns from another IP with changed TLS",
                differentTlsLogin.copy(ip = "203.0.113.50"),
                history = listOf(knownDevice.copy(riskScore = 0.95)),
            ),
            scenario(
                "IP, operating system, browser hints and TLS differ from all known logins",
                mobileLogin,
                history = listOf(
                    knownDevice,
                    knownDevice.copy(ip = "192.0.2.11"),
                    knownDevice.copy(ip = "192.0.2.12"),
                ),
            ),
        )
    }
}
