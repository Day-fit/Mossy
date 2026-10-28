export function isNewPasswordField(field: HTMLInputElement): boolean {
    if (field.type !== 'password') return false;

    const autocomplete = field.autocomplete.toLowerCase().split(/\s+/);

    if (autocomplete.includes('current-password')) return false;
    if (autocomplete.includes('new-password')) return true;

    const url = new URL(field.ownerDocument.URL);

    return (
        url.origin === 'https://github.com' &&
        /^\/signup\/?$/.test(url.pathname) &&
        field.id === 'password' &&
        ['password', 'user[password]'].includes(field.name)
    );
}
