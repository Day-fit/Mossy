package pl.dayfit.mossyvault.configuration

object StompEndpoints {
    const val WEBSOCKET_ENDPOINT = "/ws/vault-communication"

    private const val APPLICATION_PREFIX = "/app"
    private const val USER_PREFIX = "/user"
    private const val VAULT_BROKER_PREFIX = "/vault"

    const val SUBSCRIBE_SAVE = "/user/vault/save"
    const val SUBSCRIBE_DELETE = "/user/vault/delete"
    const val SUBSCRIBE_METADATA = "/user/vault/metadata"
    const val SUBSCRIBE_GET_CIPHERTEXT = "/user/vault/get-ciphertext"

    const val USER_PASSWORDS_QUERIED = "/app/vault/metadata-retrieved"
    const val USER_CIPHERTEXT_RETRIEVED = "/app/vault/ciphertext-retrieved"
    const val USER_PASSWORD_SAVED = "/app/vault/password-saved"
    const val USER_PASSWORD_DELETED = "/app/vault/password-deleted"
}