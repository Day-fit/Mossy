package pl.dayfit.mossyvault.model

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.ManyToMany
import org.hibernate.annotations.OnDelete
import org.hibernate.annotations.OnDeleteAction
import org.intellij.lang.annotations.Pattern
import java.util.UUID

@Entity
class PasswordTag(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    @Column(unique = true)
    var name: String,
    @Pattern("^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$")
    var color: String,
    @ManyToMany(mappedBy = "tags")
    @OnDelete(action = OnDeleteAction.CASCADE)
    var passwordEntries: MutableList<PasswordEntry> = mutableListOf()
)
