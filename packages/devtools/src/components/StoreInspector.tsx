import Icon from './ui/icon';
import { safeSerializeCompact } from '../utils/safeSerialize';

interface StoreInspectorProps {
    stores: Record<string, any>;
    selectedStore: string | null;
    onClose: () => void;
}

const JSONTree = ({ data, level = 0 }: { data: any; level?: number }) => {
    if (typeof data !== 'object' || data === null) {
        return (
            <span className="text-green-600 dark:text-green-400">
                {safeSerializeCompact(data)}
            </span>
        );
    }

    return (
        <div style={{ paddingLeft: level * 12 }}>
            {Object.entries(data).map(([key, value]) => (
                <div key={key} className="font-mono text-xs py-0.5">
                    <span className="text-purple-400">{key}: </span>
                    <JSONTree data={value} level={level + 1} />
                </div>
            ))}
        </div>
    );
};

export const StoreInspector: React.FC<StoreInspectorProps> = ({
    stores,
    selectedStore,
}) => {
    return (
        <div className="flex h-full">
            {/* Main View */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
                {selectedStore && stores[selectedStore] ? (
                    <div className="space-y-4">
                        {/* Store Management */}
                        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 border-b border-slate-800 pb-2">
                                Store Management
                            </h3>
                            <div className="flex flex-col gap-3">
                                {/* Persistence Status & Controls */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-slate-400">
                                            Persistence:
                                        </span>
                                        {stores[selectedStore].$persist ? (
                                            <span className="flex items-center gap-1.5 text-green-400 font-medium bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
                                                Enabled
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-slate-500 font-medium bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                                Disabled
                                            </span>
                                        )}
                                    </div>

                                    {stores[selectedStore].$persist && (
                                        <button
                                            onClick={async () => {
                                                if (
                                                    confirm(
                                                        'Are you sure you want to clear the persisted data for this store?',
                                                    )
                                                ) {
                                                    try {
                                                        await stores[
                                                            selectedStore
                                                        ].$persist.clear();
                                                        // Optional: Reset state too? Or just clear storage?
                                                        // Let's just clear storage.
                                                        alert(
                                                            'Storage cleared.',
                                                        );
                                                    } catch (e) {
                                                        console.error(e);
                                                        alert(
                                                            'Failed to clear storage.',
                                                        );
                                                    }
                                                }
                                            }}
                                            className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded text-[10px] font-medium transition-colors border border-slate-700 hover:border-red-500/30"
                                            title="Clear persisted data from storage"
                                        >
                                            <Icon name="trash" size={12} />
                                            Clear Storage
                                        </button>
                                    )}
                                </div>

                                {/* Reset Action */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
                                    <span className="text-xs text-slate-500">
                                        Reset in-memory state to initial values.
                                    </span>
                                    <button
                                        onClick={() => {
                                            if (
                                                confirm(
                                                    'Are you sure you want to reset the state? This will revert all changes.',
                                                )
                                            ) {
                                                stores[selectedStore].$reset();
                                            }
                                        }}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-xs font-medium transition-colors border border-slate-700"
                                    >
                                        <Icon name="rotate-ccw" size={12} />
                                        Reset State
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* State Section */}

                        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 border-b border-slate-800 pb-2">
                                State
                            </h3>
                            <JSONTree data={stores[selectedStore].state} />
                        </div>

                        {/* Getters Section */}
                        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 border-b border-slate-800 pb-2">
                                Getters
                            </h3>
                            {stores[selectedStore].getters &&
                                Object.keys(stores[selectedStore].getters).length >
                                0 ? (
                                <div className="space-y-1">
                                    {Object.entries(
                                        stores[selectedStore].getters,
                                    ).map(([key, getter]: [string, any]) => (
                                        <div
                                            key={key}
                                            className="flex items-start gap-2 font-mono text-xs"
                                        >
                                            <span className="text-purple-400">
                                                {key}:
                                            </span>
                                            <span className="text-yellow-400 break-all">
                                                {safeSerializeCompact(getter.value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-slate-600 italic">
                                    No getters defined
                                </div>
                            )}
                        </div>

                        {/* Actions Section */}
                        {stores[selectedStore].actions &&
                            Object.keys(stores[selectedStore].actions).length >
                            0 && (
                                <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 border-b border-slate-800 pb-2">
                                        Actions
                                    </h3>
                                    <div className="space-y-1">
                                        {Object.keys(
                                            stores[selectedStore].actions,
                                        ).map((key) => (
                                            <div
                                                key={key}
                                                className="flex items-center justify-between group"
                                            >
                                                <span className="font-mono text-xs text-blue-400">
                                                    {key}()
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        try {
                                                            stores[
                                                                selectedStore
                                                            ].actions[key]();
                                                        } catch (e) {
                                                            console.error(e);
                                                            alert(
                                                                `Action failed: ${e}`,
                                                            );
                                                        }
                                                    }}
                                                    className="p-1 text-slate-600 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Trigger Action"
                                                >
                                                    <Icon
                                                        name="play"
                                                        size={12}
                                                    />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-600 flex-col gap-2">
                        <Icon
                            name="database"
                            size={32}
                            className="opacity-20"
                        />
                        <p>Select a store to inspect</p>
                    </div>
                )}
            </div>
        </div>
    );
};
