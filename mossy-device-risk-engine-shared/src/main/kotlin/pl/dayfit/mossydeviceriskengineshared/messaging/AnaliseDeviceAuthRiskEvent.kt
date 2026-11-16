package pl.dayfit.mossydeviceriskengineshared.messaging

data class AnaliseDeviceAuthRiskEvent(
    val deviceId: String,
    val ip: String,
    val requestUserAgentHeaders: Map<
            String, String>,
    val tlsJa3: String,
    val tlsJa4: String,
)