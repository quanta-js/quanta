import { useState } from 'preact/hooks';
import Icon from './ui/icon';
import { safeSerializeCompact } from '../utils/safeSerialize';

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

const MAX_PREVIEW_LENGTH = 100;

const PayloadCell = ({ args }: { args: any[] }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    // Safely serialize the payload
    const serialized = safeSerializeCompact(args);
    const isTruncated = serialized.length > MAX_PREVIEW_LENGTH;
    const preview = isTruncated
        ? serialized.slice(0, MAX_PREVIEW_LENGTH) + '...'
        : serialized;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(serialized);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <td className="px-4 py-3 text-xs text-slate-400 font-mono">
            <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                    {isExpanded ? (
                        <div className="whitespace-pre-wrap break-all bg-slate-900/50 p-2 rounded border border-slate-800 max-h-48 overflow-y-auto">
                            {serialized}
                        </div>
                    ) : (
                        <div className="truncate max-w-[200px]" title={preview}>
                            {preview}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {isTruncated && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-1 bg-transparent hover:bg-slate-800 rounded transition-colors text-cyan-400 hover:text-cyan-300"
                            title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                            <Icon
                                name={
                                    isExpanded ? 'chevron-up' : 'chevron-down'
                                }
                                size={14}
                            />
                        </button>
                    )}
                    <button
                        onClick={handleCopy}
                        className={`p-1 bg-transparent hover:bg-slate-800 rounded transition-colors ${
                            copied
                                ? 'text-green-400'
                                : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title={copied ? 'Copied!' : 'Copy payload'}
                    >
                        <Icon name={copied ? 'check' : 'copy'} size={14} />
                    </button>
                </div>
            </div>
        </td>
    );
};

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
                            <PayloadCell args={action.args} />
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
