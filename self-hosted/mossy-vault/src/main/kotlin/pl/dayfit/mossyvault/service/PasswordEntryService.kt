package pl.dayfit.mossyvault.service

import messaging.request.type.SavePasswordRequestType
import messaging.request.type.UpdatePasswordRequestType
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
    fun save(payload: SavePasswordRequestType, decodedBlob: ByteArray): UUID {
        logger.info("Saving password entry for address={}, identifier={}", payload.address, payload.identifier)
        val entry = PasswordEntry(
            address = payload.address,
            identifier = payload.identifier,
            passwordType = payload.passwordType,
            encryptedBlob = decodedBlob,
            lastModified = Instant.now()
        )

        val savedEntry = passwordEntryRepository.save(entry)
        return requireNotNull(savedEntry.id) { "Saved password entry is missing id" }
    }

    @Transactional
    fun update(payload: UpdatePasswordRequestType, decodedBlob: ByteArray): UUID {
        logger.info("Updating password entry with id={}", payload.passwordId)
        val entry = passwordEntryRepository.findById(payload.passwordId)
            .orElseThrow { NoSuchElementException("Password entry not found for id=${payload.passwordId}") }

        entry.identifier = payload.identifier
        entry.address = payload.address
        entry.encryptedBlob = decodedBlob
        entry.lastModified = Instant.now()

        val savedEntry = passwordEntryRepository.save(entry)
        return requireNotNull(savedEntry.id) { "Saved password entry is missing id" }
    }

    @Transactional
    fun delete(passwordId: UUID): PasswordEntry {
        logger.info("Deleting password entry with id={}", passwordId)

        val entry = passwordEntryRepository.findById(passwordId)
            .orElseThrow { NoSuchElementException("Password entry not found for id=$passwordId") }

        passwordEntryRepository.deleteById(passwordId)
        return entry
    }
}
