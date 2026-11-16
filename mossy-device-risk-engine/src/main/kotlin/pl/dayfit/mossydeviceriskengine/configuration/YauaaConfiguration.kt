package pl.dayfit.mossydeviceriskengine.configuration

import nl.basjes.parse.useragent.UserAgentAnalyzer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class YauaaConfiguration {
    @Bean
    fun userAgentAnalyzer(): UserAgentAnalyzer = UserAgentAnalyzer
        .newBuilder()
        .withCache(300)
        .build()
}