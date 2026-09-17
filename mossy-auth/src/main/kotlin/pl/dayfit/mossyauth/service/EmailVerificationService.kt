package pl.dayfit.mossyauth.service

import mossymailershared.MailerMessaging
import mossymailershared.event.SendEmailCommand
import org.slf4j.LoggerFactory
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.security.authentication.LockedException
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.authentication.dao.DaoAuthenticationProvider
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.support.TransactionTemplate
import pl.dayfit.mossyauth.configuration.EmailVerificationProperties
import pl.dayfit.mossyauth.dto.request.ConfirmEmailRequestDto
import pl.dayfit.mossyauth.dto.request.RecoverVerificationRequestDto
import pl.dayfit.mossyauth.dto.response.EmailVerificationDto
import pl.dayfit.mossyauth.exception.InvalidVerificationException
import pl.dayfit.mossyauth.exception.VerificationExpiredException
import pl.dayfit.mossyauth.model.UserModel
import pl.dayfit.mossyauth.model.redis.EmailVerificationRequest
import pl.dayfit.mossyauth.repository.UserRepository
import pl.dayfit.mossyauth.service.cache.UserCacheService
import pl.dayfit.mossyauth.type.AuthProvider
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Clock
import java.util.Base64
import java.util.UUID

@Service
class EmailVerificationService(
    private val store: EmailVerificationStore,
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val properties: EmailVerificationProperties,
    private val clock: Clock,
    private val userCacheService: UserCacheService,
    private val daoAuthenticationProvider: DaoAuthenticationProvider,
    private val rabbitTemplate: RabbitTemplate,
    transactionManager: PlatformTransactionManager
) {
    private val logger = LoggerFactory.getLogger(javaClass)
    private val random = SecureRandom()
    private val transactionTemplate = TransactionTemplate(transactionManager).apply {
        propagationBehavior = TransactionDefinition.PROPAGATION_REQUIRES_NEW
    }

    /** Registration calls this after device bootstrap, inside its existing transaction. */
    fun issue(user: UserModel): VerificationIssuance {
        val code = random.nextInt(1_000_000).toString().padStart(6, '0')
        val tokenBytes = ByteArray(32)
        random.nextBytes(tokenBytes)

        val token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes)
        val codeHash = passwordEncoder.encode(code)!!
        val now = clock.instant()
        var record: EmailVerificationRequest

        do {
            record = EmailVerificationRequest(
                id = UUID.randomUUID(),
                userId = user.id!!,
                email = user.email!!,
                codeHash = codeHash,
                tokenHash = digest(token),
                expiresAt = now.plus(properties.validity),
                resendAvailableAt = now.plus(properties.resendCooldown)
            )
        } while (!store.create(record))

        val confirmationUrl = "${properties.frontendBaseUrl.trimEnd('/')}/verify-email" +
            "#verificationId=${record.id}&token=$token"
        val command = SendEmailCommand(
            UUID.randomUUID().toString(),
            "email-verification",
            record.email,
            mapOf(
                "VERIFICATION_CODE" to code,
                "EXPIRES_IN_MINUTES" to properties.validity.toMinutes().toString(),
                "CONFIRMATION_URL" to confirmationUrl
            )
        )

        return VerificationIssuance(record.metadata(), command)
    }

    fun confirm(request: ConfirmEmailRequestDto) {
        val record = transactionTemplate.execute {
            validateRequest(request)

            val initial = store.get(request.verificationId)
            val user = userRepository.findLockedById(initial.userId)
                .orElseThrow { expired() }
            val record = store.get(request.verificationId)

            if (record.email != user.email || user.authProvider != AuthProvider.LOCAL) {
                throw expired()
            }

            val correct = if (request.code != null) {
                passwordEncoder.matches(request.code, record.codeHash)
            } else {
                MessageDigest.isEqual(
                    digest(request.token!!).toByteArray(Charsets.UTF_8),
                    record.tokenHash.toByteArray(Charsets.UTF_8)
                )
            }

            store.validate(record, correct, request.code != null, user.enabled)

            if (!user.enabled) {
                user.enabled = true
                userCacheService.save(user)
            }

            record
        }

        // Activation commits before cache eviction and verification cleanup.
        bestEffort("evict activated user", record.id) {
            userCacheService.evict(record.userId)
        }
        bestEffort("complete verification", record.id) {
            store.complete(record)
        }
    }

    fun resend(id: UUID): EmailVerificationDto? {
        val issuance = transactionTemplate.execute {
            val initial = store.get(id)
            val user = userRepository.findLockedById(initial.userId)
                .orElseThrow { expired() }
            val current = store.get(id)
            store.requireCurrent(current)

            if (user.blocked) {
                throw LockedException("Account is blocked")
            }
            if (user.enabled) {
                return@execute null
            }
            if (current.email != user.email || user.authProvider != AuthProvider.LOCAL) {
                throw expired()
            }

            issue(user)
        } ?: return null

        send(issuance.command, issuance.verification.verificationId)
        return issuance.verification
    }

    fun recover(request: RecoverVerificationRequestDto): EmailVerificationDto? {
        val authentication = daoAuthenticationProvider.authenticate(
            UsernamePasswordAuthenticationToken(request.identifier, request.password)
        )
        val principal = authentication.principal as UserDetailsImpl
        val issuance = transactionTemplate.execute {
            val user = userRepository.findLockedById(principal.userId)
                .orElseThrow { BadCredentialsException("Bad credentials") }

            if (user.blocked) {
                throw LockedException("Account is blocked")
            }
            if (user.enabled) {
                return@execute null
            }
            if (user.authProvider != AuthProvider.LOCAL || user.email == null) {
                throw BadCredentialsException("Bad credentials")
            }

            issue(user)
        } ?: return null

        send(issuance.command, issuance.verification.verificationId)
        return issuance.verification
    }

    fun send(command: SendEmailCommand, verificationId: UUID) {
        bestEffort("publish verification email", verificationId) {
            rabbitTemplate.convertAndSend(
                MailerMessaging.EXCHANGE,
                MailerMessaging.SEND_ROUTING_KEY,
                command
            )
        }
    }

    private fun bestEffort(action: String, id: UUID, operation: () -> Unit) {
        try {
            operation()
        } catch (exception: Exception) {
            // Provider exception messages can contain template secrets.
            logger.warn(
                "Could not {} for request {}; failure type {}",
                action,
                id,
                exception.javaClass.simpleName
            )
        }
    }

    private fun validateRequest(request: ConfirmEmailRequestDto) {
        if ((request.code == null) == (request.token == null)) {
            throw InvalidVerificationException()
        }
    }

    private fun expired(): VerificationExpiredException {
        return VerificationExpiredException()
    }

    private fun digest(value: String): String {
        val hash = MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
        return Base64.getUrlEncoder().withoutPadding().encodeToString(hash)
    }

    data class VerificationIssuance(
        val verification: EmailVerificationDto,
        val command: SendEmailCommand
    )
}
