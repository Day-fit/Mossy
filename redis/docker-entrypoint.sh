#!/bin/sh

set -eu

: "${REDIS_PASSWORD:?REDIS_PASSWORD must be set}"
: "${REDIS_USER:=mossy}"

case "$REDIS_USER" in
    *[!a-zA-Z0-9_-]*)
        echo "REDIS_USER may contain only letters, numbers, underscores, and hyphens" >&2
        exit 1
        ;;
esac

password_hash="$(printf '%s' "$REDIS_PASSWORD" | sha256sum | cut -d ' ' -f 1)"
acl_file=/data/users.acl

umask 077

{
    echo "user default off"
    printf 'user %s on #%s ~* &* +@all\n' "$REDIS_USER" "$password_hash"
} > "$acl_file"

exec redis-server --aclfile "$acl_file"
