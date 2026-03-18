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
    @Transactional
    fun saveOrUpdate(requestDto: SavePasswordRequestDto, decodedBlob: ByteArray): UUID {
        val existing = requestDto.passwordId?.let { passwordEntryRepository.findById(it).orElse(null) }
            ?: passwordEntryRepository.findByDomainAndIdentifier(requestDto.domain, requestDto.identifier).firstOrNull()

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
        return passwordEntryRepository.save(entry).id!!
    }

    @Transactional
    fun update(requestDto: UpdatePasswordRequestDto) {
        val passwordEntry = passwordEntryRepository.findById(requestDto.passwordId).orElse(null) ?: return
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
