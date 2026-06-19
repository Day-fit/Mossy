package pl.dayfit.mossyvault.configuration

object StompEndpoints {
    const val WEBSOCKET_ENDPOINT = "/ws/vault-communication"

    const val SUBSCRIBE_SAVE_PASSWORD = "/user/vault/save"
    const val SUBSCRIBE_UPDATE_PASSWORD = "/user/vault/update"
    const val SUBSCRIBE_CREATE_TAG = "/user/vault/save-tag"
    const val SUBSCRIBE_DELETE_PASSWORD = "/user/vault/delete"
    const val SUBSCRIBE_METADATA = "/user/vault/metadata"
    const val SUBSCRIBE_GET_CIPHERTEXT = "/user/vault/ciphertext"
    const val SUBSCRIBE_TAG_ASSIGN = "/user/vault/assign-tag"
    const val SUBSCRIBE_GET_TAGS = "/user/vault/get-tags"
    const val SUBSCRIBE_UPDATE_TAG = "/user/vault/update-tag"
    const val SUBSCRIBE_DELETE_TAG = "/user/vault/delete-tag"
    const val SUBSCRIBE_UNASSIGN_TAG = "/user/vault/unassign-tag"
    const val SUBSCRIBE_SAVE_NOTE = "/user/vault/save-note"
    const val SUBSCRIBE_GET_NOTE = "/user/vault/get-note"

    const val USER_METADATA_RETRIEVED = "/app/vault/metadata-retrieved"
    const val USER_CIPHERTEXT_RETRIEVED = "/app/vault/ciphertext-retrieved"
    const val USER_PASSWORD_SAVED = "/app/vault/password-saved"
    const val USER_PASSWORD_UPDATED = "/app/vault/password-updated"
    const val USER_PASSWORD_DELETED = "/app/vault/password-deleted"
    const val USER_TAG_SAVED = "/app/vault/tag-saved"
    const val USER_TAG_ASSIGNED = "/app/vault/tag-assigned"
    const val USER_TAGS_RETRIEVED = "/app/vault/tags-retrieved"
    const val USER_TAG_UPDATED = "/app/vault/tag-updated"
    const val USER_TAG_DELETED = "/app/vault/tag-deleted"
    const val USER_TAG_UNASSIGNED = "/app/vault/tag-unassigned"
    const val USER_NOTE_SAVED = "/app/vault/note-saved"
    const val USER_NOTE_RETRIEVED = "/app/vault/note-retrieved"
}
