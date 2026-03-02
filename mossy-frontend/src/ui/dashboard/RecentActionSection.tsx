import { motion } from "framer-motion";
import RecentActionEntry from "./RecentActionEntry.tsx";

export default function RecentActionSection() {
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
                <RecentActionEntry
                    date="2026-03-01T19:21:42.321Z"
                    actionType="removed"
                    domain="https://chatgpt.com"
                />
                <RecentActionEntry
                    date="2026-03-01T19:21:42.321Z"
                    actionType="added"
                    domain="https://chatgpt.com"
                />
                <RecentActionEntry
                    date="2026-03-01T19:21:42.321Z"
                    actionType="added"
                    domain="https://chatgpt.com"
                />
                <RecentActionEntry
                    date="2026-03-01T19:21:42.321Z"
                    actionType="added"
                    domain="https://chatgpt.com"
                />
                <RecentActionEntry
                    date="2026-03-01T19:21:42.321Z"
                    actionType="added"
                    domain="https://chatgpt.com"
                />
                <RecentActionEntry
                    date="2026-03-01T19:21:42.321Z"
                    actionType="added"
                    domain="https://chatgpt.com"
                />
                <RecentActionEntry
                    date="2026-03-01T19:21:42.321Z"
                    actionType="added"
                    domain="https://chatgpt.com"
                />
                <RecentActionEntry
                    date="2026-03-01T19:21:42.321Z"
                    actionType="added"
                    domain="https://chatgpt.com"
                />
                <RecentActionEntry
                    date="2026-03-01T19:21:42.321Z"
                    actionType="added"
                    domain="https://chatgpt.com"
                />
                <RecentActionEntry
                    date="2026-03-01T19:21:42.321Z"
                    actionType="added"
                    domain="https://chatgpt.com"
                />
                <RecentActionEntry
                    date="2026-03-01T19:21:42.321Z"
                    actionType="added"
                    domain="https://chatgpt.com"
                />
                <RecentActionEntry
                    date="2026-03-01T19:21:42.321Z"
                    actionType="added"
                    domain="https://chatgpt.com"
                />
                <RecentActionEntry
                    date="2026-03-01T19:21:42.321Z"
                    actionType="added"
                    domain="https://chatgpt.com"
                />
                <RecentActionEntry
                    date="2026-03-01T19:21:42.321Z"
                    actionType="added"
                    domain="https://chatgpt.com"
                />
            </div>
        </motion.aside>
    );
}