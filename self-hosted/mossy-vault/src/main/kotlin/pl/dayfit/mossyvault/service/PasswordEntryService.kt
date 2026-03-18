package pl.dayfit.mossyvault.service

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import pl.dayfit.mossyvault.dto.request.SavePasswordRequestDto
import pl.dayfit.mossyvault.model.PasswordEntry
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import java.time.Instant
import java.util.UUID

@Service
class PasswordEntryService(
    private val passwordEntryRepository: PasswordEntryRepository
) {
    @Transactional
    fun saveOrUpdate(passwordId: UUID, requestDto: SavePasswordRequestDto, decodedBlob: ByteArray) {
        val entry = passwordEntryRepository.findById(passwordId).orElseGet {
            PasswordEntry(
                domain = requestDto.domain,
                identifier = requestDto.identifier,
                encryptedBlob = decodedBlob,
                lastModified = Instant.now()
            )
        }.apply {
            identifier = requestDto.identifier
            domain = requestDto.domain
            encryptedBlob = decodedBlob
            lastModified = Instant.now()
        }
        passwordEntryRepository.save(entry)
    }
}