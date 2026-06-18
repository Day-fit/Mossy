import type { Variants } from "framer-motion";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: "easeOut" },
  },
};

export const panel =
  "rounded-lg border border-gray-200 bg-white p-4 shadow-sm";

export const section =
  "flex flex-col gap-3";

export const panelTitleRow =
  "flex items-start justify-between gap-3";

export const sectionHeader =
  "flex flex-col gap-1";

export const eyebrow =
  "text-[11px] font-bold uppercase text-gray-500";

export const heroTitle =
  "max-w-[290px] text-[22px] font-semibold leading-tight text-gray-900";

export const sectionTitle =
  "text-[17px] font-semibold text-gray-900";

export const subtitle =
  "text-xs leading-relaxed text-gray-600";

export const input =
  "w-full border-0 border-b-2 border-gray-200 bg-white px-0.5 py-2.5 text-[13px] text-gray-900 outline-none transition focus:border-[#007735] focus:shadow-[0_2px_0_rgba(0,119,53,0.10)] placeholder:text-gray-400";

export const primaryButton =
  "min-h-9 rounded-md bg-black px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-[#005a28] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:active:scale-100";

export const secondaryButton =
  "min-h-9 rounded-md border border-gray-200 bg-white px-3 py-2 text-[13px] font-semibold text-gray-900 transition hover:border-gray-300 hover:bg-gray-50 active:scale-[0.99]";

export const compactButton =
  "min-h-8 shrink-0 rounded-md bg-black px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#005a28] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:active:scale-100";

export const compactSecondaryButton =
  "min-h-8 shrink-0 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-900 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400";

export const countPill =
  "inline-flex h-6 shrink-0 items-center rounded-full bg-gray-100 px-2.5 text-[11px] font-semibold text-gray-600";

export const emptyState =
  "rounded-lg border border-dashed border-gray-200 bg-white p-3 text-xs text-gray-500";

export const listItem =
  "flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3";

export const itemTitle =
  "[overflow-wrap:anywhere] text-[13px] font-semibold leading-snug text-gray-900";

export const itemSubtitle =
  "truncate text-[11px] leading-snug text-gray-600";

export const itemMeta =
  "mt-0.5 truncate text-[11px] leading-snug text-gray-400";

export const statusSuccess =
  "rounded-lg bg-emerald-50 px-3 py-2.5 text-xs leading-relaxed text-emerald-700";

export const statusError =
  "rounded-lg bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-700";
