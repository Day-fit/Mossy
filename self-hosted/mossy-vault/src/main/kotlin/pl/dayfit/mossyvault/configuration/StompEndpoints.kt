package pl.dayfit.mossyvault.configuration

object StompEndpoints {
    const val WEBSOCKET_ENDPOINT = "/ws/vault-communication"

    const val APPLICATION_PREFIX = "/app"
    const val USER_PREFIX = "/user"
    const val VAULT_BROKER_PREFIX = "/vault"

    const val SUBSCRIBE_SAVE = "/user/vault/save"
    const val SUBSCRIBE_DELETE = "/user/vault/delete"
    const val SUBSCRIBE_UPDATE = "/user/vault/update"
    const val SUBSCRIBE_EXTRACT_CIPHERTEXT = "/user/vault/extract-ciphertext"
    const val SUBSCRIBE_QUERY_BY_DOMAIN = "/user/vault/query-by-domain"
    const val SUBSCRIBE_GET_CIPHERTEXT = "/user/vault/get-ciphertext"

    const val SEND_SAVE_ACK = "/app/vault/password-save-ack"
    const val USER_PASSWORDS_QUERIED = "/app/vault/passwords-queried"
    const val USER_CIPHERTEXT_RETRIEVED = "/app/vault/ciphertext-retrieved"
    const val USER_PASSWORD_DELETED = "/app/vault/password-deleted"
}