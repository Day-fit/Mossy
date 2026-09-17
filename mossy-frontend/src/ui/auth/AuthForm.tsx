import { motion } from 'framer-motion';

export const authCardClass =
    'bg-white shadow-2xl rounded-2xl py-10 px-6 sm:px-10 lg:px-20 space-y-7 w-full md:w-1/2 max-w-xl my-5';
export const authInputClass =
    'w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors duration-300';
export const authButtonClass =
    'w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed';

export function AuthBusyLabel({ children }: { children: string }) {
    return (
        <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
        >
            {children}
        </motion.span>
    );
}
