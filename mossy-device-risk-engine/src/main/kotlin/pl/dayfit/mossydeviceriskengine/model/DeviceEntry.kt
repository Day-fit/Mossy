package pl.dayfit.mossydeviceriskengine.model

import nl.basjes.parse.useragent.UserAgent

data class DeviceEntry(
    val ip: String,
    val tlsJa3: String,
    val tlsJa4: String,
    val userAgent: UserAgent.ImmutableUserAgent,
    val riskScore: Double,
)
