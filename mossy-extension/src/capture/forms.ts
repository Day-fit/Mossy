export type PasswordForm = {
    form: HTMLFormElement;
    password: HTMLInputElement;
    passwords: HTMLInputElement[];
    username: HTMLInputElement | null;
};

export function eligible(field: HTMLInputElement) {
    return (
        !field.disabled &&
        !field.readOnly &&
        field.type !== 'hidden' &&
        field.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    );
}

export function readForm(form: HTMLFormElement): PasswordForm | undefined {
    const inputs = Array.from(form.querySelectorAll('input')).filter(eligible);
    const passwords = inputs.filter((input) => input.type === 'password');
    const password = passwords[0];

    if (!password) return;

    const username =
        inputs.find(
            (input) =>
                ['username', 'email'].includes(input.autocomplete) ||
                ['email', 'text', 'tel'].includes(input.type)
        ) ?? null;

    return { form, password, passwords, username };
}

export function fillInputs(values: [HTMLInputElement, string][]) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
    )!.set!;

    // Set every value before notifying the page. Never submit the form.
    for (const [input, value] of values) setter.call(input, value);

    for (const [input] of values) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
}
