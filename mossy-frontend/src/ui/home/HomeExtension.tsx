import { MdExtension, MdOpenInNew } from 'react-icons/md';
import { extensionSetupUrl } from '../../helpers/projectLinks.ts';

export default function HomeExtension() {
    return (
        <section
            aria-labelledby="extension-heading"
            className="border-y border-border bg-surface-subtle px-6 py-12 sm:px-10 md:px-12 md:py-16 lg:px-20"
        >
            <div className="mx-auto grid max-w-7xl items-center gap-10 md:grid-cols-2 md:gap-14 lg:gap-24">
                <div className="min-w-0">
                    <p className="mb-5 flex items-center gap-2.5 text-sm font-semibold text-fg-brand">
                        <MdExtension className="size-5" aria-hidden="true" />
                        Mossy for Chrome
                    </p>
                    <h2
                        id="extension-heading"
                        className="max-w-lg text-3xl leading-tight sm:text-4xl lg:text-5xl"
                    >
                        Your vault, a click away.
                    </h2>
                    <p className="mt-5 max-w-md text-base leading-relaxed text-fg-secondary">
                        Fill saved logins and save new passwords without leaving
                        the page. Connect your own vault with the Mossy browser
                        extension.
                    </p>
                    <a
                        href={extensionSetupUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-8 inline-flex min-h-12 items-center justify-center gap-3 rounded-md bg-brand px-6 py-3 text-sm font-semibold whitespace-nowrap text-fg-inverse hover:bg-brand-hover motion-safe:active:scale-[0.98]"
                    >
                        Set up the extension
                        <MdOpenInNew className="size-4" aria-hidden="true" />
                    </a>
                    <p className="mt-4 max-w-sm text-xs leading-relaxed text-fg-muted">
                        Install from GitHub Releases. Chrome Web Store coming
                        soon.
                    </p>
                </div>
                <figure className="mx-auto w-full max-w-[400px]">
                    <div className="overflow-hidden rounded-xl border border-border bg-surface-page shadow-card">
                        <img
                            className="block h-auto w-full in-[[data-theme=dark]]:hidden [@media(prefers-color-scheme:dark)]:in-[:root:not([data-theme=light]):not([data-theme=dark])]:hidden"
                            src="/extension/popup-light.png"
                            alt="Mossy extension showing vault selection, saved logins, and password actions."
                            width="520"
                            height="574"
                            loading="lazy"
                            decoding="async"
                        />
                        <img
                            className="hidden h-auto w-full in-[[data-theme=dark]]:block [@media(prefers-color-scheme:dark)]:in-[:root:not([data-theme=light]):not([data-theme=dark])]:block"
                            src="/extension/popup-dark.png"
                            alt="Mossy extension showing vault selection, saved logins, and password actions."
                            width="520"
                            height="574"
                            loading="lazy"
                            decoding="async"
                        />
                    </div>
                    <figcaption className="mt-3 text-center text-xs text-fg-muted">
                        The Mossy extension with an example vault.
                    </figcaption>
                </figure>
            </div>
        </section>
    );
}
