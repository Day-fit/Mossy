package pl.dayfit.mossymailer.repository

import org.springframework.data.repository.CrudRepository
import org.springframework.stereotype.Repository
import pl.dayfit.mossymailer.entity.MailCommandStatusEntry

@Repository
interface MailerIdempotencyRepository : CrudRepository<MailCommandStatusEntry, String>