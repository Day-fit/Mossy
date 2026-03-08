import { motion } from "framer-motion";
import {CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import {formatDate} from "../../helpers/DateFormatHelper.ts";

interface PasswordData {
    date: string;
    addedCount: number;
}

const dummyData: PasswordData[] = [
    {date: new Date().toISOString(), addedCount: 10},
    {date: new Date().toISOString(), addedCount: 20}
];

export default function PasswordChart() {
    return <motion.div className="w-full h-full p-5 rounded-md flex flex-col justify-center items-center ">
        <h2 className="text-lg text-gray-700">Secured passwords</h2>
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dummyData}>
                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis dataKey="date" tickFormatter={formatDate}/>
                <YAxis/>
                <Tooltip labelFormatter={(value) => formatDate(value as string)}/>
                <Line
                    type="monotone"
                    dataKey="addedCount"
                    stroke="#00bc7d"
                    strokeWidth={3}
                />
            </LineChart>
        </ResponsiveContainer>
    </motion.div>
}