package pl.dayfit.mossyvault.service

import messaging.request.type.SavePasswordRequestType
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import pl.dayfit.mossyvault.model.PasswordEntry
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import java.time.Instant
import java.util.UUID

@Service
class PasswordEntryService(
    private val passwordEntryRepository: PasswordEntryRepository
) {
    private val logger = org.slf4j.LoggerFactory.getLogger(PasswordEntryService::class.java)

    @Transactional
    fun saveOrUpdate(payload: SavePasswordRequestType, decodedBlob: ByteArray): UUID {
        val targetIdentifier = payload.identifier
        val targetDomain = payload.domain

        logger.info("Saving or updating password entry for domain={}, identifier={}", targetDomain, targetIdentifier)
        val existing = passwordEntryRepository.findFirstByDomainAndIdentifier(targetDomain, targetIdentifier)

        val entry = (existing ?: PasswordEntry(
            domain = targetDomain,
            identifier = targetIdentifier,
            encryptedBlob = decodedBlob,
            lastModified = Instant.now()
        )).apply {
            identifier = targetIdentifier
            domain = targetDomain
            encryptedBlob = decodedBlob
            lastModified = Instant.now()
        }
        val savedEntry = passwordEntryRepository.save(entry)
        return requireNotNull(savedEntry.id) { "Saved password entry is missing id" }
    }

    @Transactional
    fun delete(passwordId: UUID) {
        logger.info("Deleting password entry with id={}", passwordId)
        passwordEntryRepository.deleteById(passwordId)
    }
}
