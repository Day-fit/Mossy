package pl.dayfit.mossyvault.service

import messaging.request.type.SavePasswordRequestType
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import pl.dayfit.mossyvault.model.PasswordEntry
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import type.PasswordSaveType
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
        val targetAddress = payload.address

        logger.info("Saving or updating password entry for address={}, identifier={}", targetAddress, targetIdentifier)
        val existing = passwordEntryRepository.findFirstByAddressAndIdentifier(targetAddress, targetIdentifier)

        val entry = (existing ?: PasswordEntry(
            address = targetAddress,
            identifier = targetIdentifier,
            encryptedBlob = decodedBlob,
            lastModified = Instant.now()
        )).apply {
            identifier = targetIdentifier
            address = targetAddress
            encryptedBlob = decodedBlob
            lastModified = Instant.now()
        }

        if (payload.saveType == PasswordSaveType.SAVE && payload.passwordType != null) {
            entry.passwordType = payload.passwordType!!
        }

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
