import Icon from './ui/icon';

interface ActionInfo {
    id: string;
    storeName: string;
    actionName: string;
    args: any[];
    timestamp: number;
}

interface ActionLogProps {
    actions: ActionInfo[];
}

export const ActionLog: React.FC<ActionLogProps> = ({ actions }) => {
    if (actions.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <Icon size={32} name="play" className="mb-2 opacity-20" />
                <p>No actions recorded yet</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-900 sticky top-0 z-10">
                    <tr>
                        <th className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">
                            Time
                        </th>
                        <th className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">
                            Store
                        </th>
                        <th className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">
                            Action
                        </th>
                        <th className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">
                            Payload
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                    {actions.map((action) => (
                        <tr
                            key={action.id}
                            className="hover:bg-slate-900/50 transition-colors"
                        >
                            <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                                {new Date(
                                    action.timestamp,
                                ).toLocaleTimeString()}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-slate-200">
                                {action.storeName}
                            </td>
                            <td className="px-4 py-3 text-sm text-cyan-400 font-mono">
                                {action.actionName}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400 font-mono truncate max-w-[200px]">
                                {JSON.stringify(action.args)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
