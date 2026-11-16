package pl.dayfit.mossydeviceriskengineshared.messaging

data class AnaliseRiskMessage(
    val deviceId: String,
    val userAgent: String,
)