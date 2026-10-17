package pl.dayfit.mossykeysync.configuration

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.boot.autoconfigure.AutoConfigurations
import org.springframework.boot.data.redis.autoconfigure.DataRedisAutoConfiguration
import org.springframework.boot.jackson.autoconfigure.JacksonAutoConfiguration
import org.springframework.boot.test.context.runner.ApplicationContextRunner
import org.springframework.data.redis.connection.RedisConnectionFactory
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.serializer.RedisSerializer
import pl.dayfit.mossykeysync.model.redis.KeySyncInfo
import pl.dayfit.mossykeysync.service.KeySyncService
import java.security.SecureRandom
import java.util.UUID
import kotlin.test.assertEquals

@ExtendWith(MockitoExtension::class)
class RedisConfigurationTest {
    @Mock
    lateinit var connectionFactory: RedisConnectionFactory

    @Test
    fun `key sync service starts with a template that preserves receiver info in values and hashes`() {
        ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(DataRedisAutoConfiguration::class.java, JacksonAutoConfiguration::class.java))
            .withBean(RedisConnectionFactory::class.java, { connectionFactory })
            .withBean(SecureRandom::class.java, { SecureRandom() })
            .withUserConfiguration(RedisConfiguration::class.java, KeySyncService::class.java)
            .run { context ->
                assertThat(context).hasNotFailed().hasSingleBean(KeySyncService::class.java)
                val template = context.getBean("keySyncRedisTemplate", RedisTemplate::class.java)
                val userId = UUID.fromString("7985807b-8385-40e8-9f58-7945aece4cb5")
                val info = KeySyncInfo(
                    userId,
                    UUID.fromString("c2c13869-d6e0-4e25-9483-2ac0a7931bf9"),
                    UUID.fromString("bc4881b7-a4d2-49df-824f-dda2428333f0"),
                    mapOf("kty" to "OKP", "crv" to "X25519", "x" to "receiver-public-key"),
                    "receiver-signature",
                )

                assertEquals("$userId:ABC123", roundTrip(template.keySerializer, "$userId:ABC123"))
                assertEquals("ABC123", roundTrip(template.hashKeySerializer, "ABC123"))
                assertEquals(info, roundTrip(template.valueSerializer, info))
                assertEquals(info, roundTrip(template.hashValueSerializer, info))
            }
    }

    @Suppress("UNCHECKED_CAST")
    private fun roundTrip(serializer: RedisSerializer<*>, value: Any): Any? {
        val typedSerializer = serializer as RedisSerializer<Any>
        return typedSerializer.deserialize(typedSerializer.serialize(value))
    }
}
