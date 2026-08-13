package pl.dayfit.mossydevicetrust.dto.request

import org.bouncycastle.crypto.digests.SHA256Digest
import tools.jackson.databind.ObjectMapper

interface Hashable {
    companion object {
        val objectMapper = ObjectMapper()
    }

    fun hash(): ByteArray {
        val json = objectMapper.writeValueAsString(this)

        val bytes = json.toByteArray(Charsets.UTF_8)

        val digest = SHA256Digest().apply {
            update(bytes, 0, bytes.size)
        }

        val hash = ByteArray(digest.digestSize)
        digest.doFinal(hash, 0)

        return hash
    }
}