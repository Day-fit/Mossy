package pl.dayfit.mossypassword.dev

import jakarta.annotation.PostConstruct
import jakarta.persistence.EntityManager
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.core.env.Environment
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionTemplate
import pl.dayfit.mossypassword.configuration.properties.ApiKeysDevProperties
import java.time.Instant
import java.util.*


@Component
@EnableConfigurationProperties(ApiKeysDevProperties::class)
class DevelopmentSetupHandler(
    private val environment: Environment,
    private val apiKeyDevProperties: ApiKeysDevProperties,
    private val passwordEncoder: PasswordEncoder,
    private val entityManager: EntityManager,
    private val transactionTemplate: TransactionTemplate
) {
    private val logger = org.slf4j.LoggerFactory.getLogger(this::class.java)

    @PostConstruct
    fun init() {
        if (!environment.matchesProfiles("dev")) return

        val devPropertiesIncorrect = apiKeyDevProperties.apiKey == null
                || apiKeyDevProperties.ownerId == null
                || apiKeyDevProperties.vaultId == null
                || apiKeyDevProperties.vaultName == null

        if (devPropertiesIncorrect) {
            logger.warn("Some of development properties are not set, skipping registration of development vault")
            return
        }

        transactionTemplate.execute {
            registerDevelopmentVault(
                apiKeyDevProperties.ownerId!!,
                apiKeyDevProperties.vaultId!!,
                apiKeyDevProperties.vaultName!!,
                apiKeyDevProperties.apiKey!!
            )
        }
    }

    private fun registerDevelopmentVault(userId: UUID, vaultId: UUID, vaultName: String, apiKey: String)
    {
        entityManager.createNativeQuery("""
        INSERT INTO vault (id, name, owner_id, secret_hash, is_online, last_seen_at) 
        VALUES (:id, :name, :ownerId, :secretHash, false, :lastSeenAt)
    """)
            .setParameter("id", vaultId)
            .setParameter("name", vaultName)
            .setParameter("ownerId", userId)
            .setParameter("secretHash", passwordEncoder.encode(apiKey))
            .setParameter("lastSeenAt", Instant.now())
            .executeUpdate()

        logger.info("Development vault registered: $vaultName")
    }
}
