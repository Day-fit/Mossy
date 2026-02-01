package pl.dayfit.mossyvault.service

import org.springframework.stereotype.Service
import pl.dayfit.mossyvault.repository.PasswordEntryRepository

@Service
class PasswordEntryService(
    private val passwordEntryRepository: PasswordEntryRepository
) {

}