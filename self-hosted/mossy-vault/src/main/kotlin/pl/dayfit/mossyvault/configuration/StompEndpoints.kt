package pl.dayfit.mossyvault.configuration

object StompEndpoints {
    const val WEBSOCKET_ENDPOINT = "/ws/vault-communication"

    private const val APPLICATION_PREFIX = "/app"
    private const val USER_PREFIX = "/user"
    private const val VAULT_BROKER_PREFIX = "/vault"

    const val SUBSCRIBE_SAVE = "$USER_PREFIX/$VAULT_BROKER_PREFIX/save"
    const val SUBSCRIBE_DELETE = "$USER_PREFIX/$VAULT_BROKER_PREFIX/delete"
    const val SUBSCRIBE_EXTRACT_CIPHERTEXT = "/user/vault/extract-ciphertext"
    const val SUBSCRIBE_QUERY_BY_DOMAIN = "/user/vault/query-by-domain"
    const val SUBSCRIBE_GET_CIPHERTEXT = "/user/vault/get-ciphertext"

    const val USER_PASSWORD_SAVED = "/app/vault/password-saved"
    const val USER_PASSWORDS_QUERIED = "/app/vault/passwords-queried"
    const val USER_CIPHERTEXT_RETRIEVED = "/app/vault/ciphertext-retrieved"
    const val USER_PASSWORD_DELETED = "/app/vault/password-deleted"
}