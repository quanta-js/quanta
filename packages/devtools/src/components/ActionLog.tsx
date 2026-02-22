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

function PayloadCell({ args }: { args: any[] }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const serialized = safeSerializeCompact(args);
    const isTruncated = serialized.length > MAX_PREVIEW_LENGTH;
    const preview = isTruncated
        ? serialized.slice(0, MAX_PREVIEW_LENGTH) + '…'
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
        <td class="qdt-actions-payload">
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px',
                }}
            >
                <div style={{ flex: 1, minWidth: 0 }}>
                    {isExpanded ? (
                        <div class="qdt-actions-payload-expanded">
                            {serialized}
                        </div>
                    ) : (
                        <div class="qdt-actions-payload-text" title={preview}>
                            {preview}
                        </div>
                    )}
                </div>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        flexShrink: 0,
                    }}
                >
                    {isTruncated && (
                        <button
                            class="qdt-btn-ghost"
                            onClick={() => setIsExpanded(!isExpanded)}
                            title={isExpanded ? 'Collapse' : 'Expand'}
                            style={{ opacity: 1 }}
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
                        class="qdt-btn-ghost"
                        onClick={handleCopy}
                        title={copied ? 'Copied!' : 'Copy payload'}
                        style={{
                            opacity: 1,
                            color: copied ? 'var(--json-string)' : undefined,
                        }}
                    >
                        <Icon name={copied ? 'check' : 'copy'} size={14} />
                    </button>
                </div>
            </div>
        </td>
    );
}

export function ActionLog({ actions }: ActionLogProps) {
    if (actions.length === 0) {
        return (
            <div class="qdt-empty">
                <Icon name="activity" size={28} />
                <span>No actions recorded yet</span>
            </div>
        );
    }

    return (
        <div style={{ height: '100%', overflowY: 'auto' }}>
            <table class="qdt-actions-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Store</th>
                        <th>Action</th>
                        <th>Payload</th>
                    </tr>
                </thead>
                <tbody>
                    {actions.map((action) => (
                        <tr key={action.id}>
                            <td class="qdt-actions-time">
                                {new Date(
                                    action.timestamp,
                                ).toLocaleTimeString()}
                            </td>
                            <td class="qdt-actions-store">
                                {action.storeName}
                            </td>
                            <td class="qdt-actions-name">
                                {action.actionName}
                            </td>
                            <PayloadCell args={action.args} />
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
