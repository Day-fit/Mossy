package pl.dayfit.mossyvault.service

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import pl.dayfit.mossyvault.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossyvault.dto.request.SavePasswordRequestDto
import pl.dayfit.mossyvault.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossyvault.model.PasswordEntry
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import java.time.Instant
import java.util.UUID
import kotlin.io.encoding.Base64

@Service
class PasswordEntryService(
    private val passwordEntryRepository: PasswordEntryRepository
) {
    private val logger = org.slf4j.LoggerFactory.getLogger(PasswordEntryService::class.java)

    @Transactional
    fun saveOrUpdate(requestDto: SavePasswordRequestDto, decodedBlob: ByteArray): UUID {
        val existing = if (requestDto.passwordId != null) {
            passwordEntryRepository.findById(requestDto.passwordId).orElse(null)
        } else {
            passwordEntryRepository.findFirstByDomainAndIdentifier(requestDto.domain, requestDto.identifier)
        }

        val entry = (existing ?: PasswordEntry(
            domain = requestDto.domain,
            identifier = requestDto.identifier,
            encryptedBlob = decodedBlob,
            lastModified = Instant.now()
        )).apply {
            identifier = requestDto.identifier
            domain = requestDto.domain
            encryptedBlob = decodedBlob
            lastModified = Instant.now()
        }
        val savedEntry = passwordEntryRepository.save(entry)
        return requireNotNull(savedEntry.id) {
            "Saved password entry is missing id for domain=${requestDto.domain}, identifier=${requestDto.identifier}"
        }
    }

    @Transactional
    fun update(requestDto: UpdatePasswordRequestDto) {
        val passwordEntry = passwordEntryRepository.findById(requestDto.passwordId).orElse(null)
        if (passwordEntry == null) {
            logger.warn("Password entry not found for update, id={}", requestDto.passwordId)
            return
        }
        passwordEntry.identifier = requestDto.identifier
        passwordEntry.domain = requestDto.domain
        passwordEntry.encryptedBlob = Base64.decode(requestDto.cipherText)
        passwordEntry.lastModified = Instant.now()
        passwordEntryRepository.save(passwordEntry)
    }

    @Transactional
    fun delete(requestDto: DeletePasswordRequestDto) {
        passwordEntryRepository.deleteById(requestDto.passwordId)
    }
}
