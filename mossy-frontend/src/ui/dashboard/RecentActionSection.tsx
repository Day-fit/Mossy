import { motion } from "framer-motion";
import RecentActionEntry from "./RecentActionEntry.tsx";

type RecentAction = {
    date: string;
    actionType: "added" | "removed" | "updated";
    domain: string;
}

type RecentActionSectionProps = {
    actions: RecentAction[];
}

export default function RecentActionSection({actions}: RecentActionSectionProps) {
    return (
        <motion.aside
            className="flex flex-col h-full min-h-0 rounded-md bg-white shadow-2xl"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
        >
            <h2 className="text-lg text-gray-700 mt-5 text-center shrink-0">
                Recent actions
            </h2>

            <div
                className="flex flex-col gap-2
                px-4 py-4
                overflow-y-auto
                items-center
                scrollbar
                scrollbar-thin
                scrollbar-thumb-gray-400
                scrollbar-track-transparent
                hover:scrollbar-thumb-gray-500"
            >
                {actions.map((action, index) => (
                    <RecentActionEntry
                        key={`${action.domain}-${action.date}-${index}`}
                        date={action.date}
                        actionType={action.actionType}
                        domain={action.domain}
                    />
                ))}
            </div>
        </motion.aside>
    );
}