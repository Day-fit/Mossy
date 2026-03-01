import {formatDate} from "../../helpers/DateFormatHelper.ts";

type RecentActionElementProps = {
    actionType: "added" | "removed" | "updated";
    date: string;
    domain: string;
}

export default function RecentActionEntry({actionType, date, domain}: RecentActionElementProps) {
    // const textToIcon = (text: string) => {
    //     switch (text) {
    //
    //     }
    // }

    return <div className="flex items-center justify-around w-11/12 bg-gray-200 py-3 px-2 rounded-md">
        <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt={`${domain} icon`} className="w-6 h-6 mr-2"/>
        <h2 className="text-lg">{actionType}</h2>
        <span className="text-xs text-gray-500 ml-2">{formatDate(date)}</span>
    </div>
}