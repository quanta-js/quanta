import { useState } from 'preact/hooks';
import Icon from './ui/icon';
import { safeSerializeCompact } from '../utils/safeSerialize';

interface StoreInspectorProps {
    stores: Record<string, any>;
    selectedStore: string | null;
}

/* ─── Interactive JSON Tree ─────────────── */

const JSONValue = ({ value, depth = 0 }: { value: any; depth?: number }) => {
    if (value === null) return <span class="qdt-json-null">null</span>;
    if (value === undefined)
        return <span class="qdt-json-null">undefined</span>;

    const type = typeof value;

    if (type === 'string')
        return <span class="qdt-json-string">"{value}"</span>;
    if (type === 'number')
        return <span class="qdt-json-number">{String(value)}</span>;
    if (type === 'boolean')
        return <span class="qdt-json-boolean">{value ? 'true' : 'false'}</span>;
    if (type === 'function')
        return <span class="qdt-json-fn">ƒ {value.name || 'anonymous'}()</span>;

    // Object or Array
    if (type === 'object') {
        return <JSONObject data={value} depth={depth} />;
    }

    return <span class="qdt-json-string">{String(value)}</span>;
};

const JSONObject = ({ data, depth = 0 }: { data: any; depth?: number }) => {
    const [isOpen, setIsOpen] = useState(depth < 2);
    const isArray = Array.isArray(data);
    const entries = Object.entries(data);
    const bracket = isArray ? ['[', ']'] : ['{', '}'];

    if (entries.length === 0) {
        return (
            <span class="qdt-json-bracket">
                {bracket[0]}
                {bracket[1]}
            </span>
        );
    }

    return (
        <span>
            <span
                class="qdt-json-toggle"
                data-open={isOpen}
                onClick={() => setIsOpen(!isOpen)}
            >
                <Icon name="chevron-right" size={10} />
            </span>
            <span class="qdt-json-bracket">{bracket[0]}</span>
            {!isOpen && (
                <span class="qdt-json-summary">
                    {' '}
                    {entries.length} {isArray ? 'items' : 'keys'}{' '}
                </span>
            )}
            {!isOpen && <span class="qdt-json-bracket">{bracket[1]}</span>}
            {isOpen && (
                <div class="qdt-json-children">
                    {entries.map(([key, val]) => (
                        <div class="qdt-json-row" key={key}>
                            <span class="qdt-json-key">
                                {isArray ? key : `"${key}"`}
                            </span>
                            <span class="qdt-json-colon">: </span>
                            <JSONValue value={val} depth={depth + 1} />
                        </div>
                    ))}
                </div>
            )}
            {isOpen && <span class="qdt-json-bracket">{bracket[1]}</span>}
        </span>
    );
};

/* ─── Store Inspector ───────────────────── */

export function StoreInspector({ stores, selectedStore }: StoreInspectorProps) {
    if (!selectedStore || !stores[selectedStore]) {
        return (
            <div class="qdt-empty">
                <Icon name="database" size={28} />
                <span>Select a store to inspect</span>
            </div>
        );
    }

    const store = stores[selectedStore];

    return (
        <div>
            {/* Store Management */}
            <div class="qdt-card">
                <div class="qdt-card-title">
                    Store Management — {selectedStore}
                </div>

                <div class="qdt-row">
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '11px',
                        }}
                    >
                        <span style={{ color: 'var(--text-muted)' }}>
                            Persistence:
                        </span>
                        {store.$persist ? (
                            <span class="qdt-badge qdt-badge-on">
                                <span class="qdt-badge-dot" />
                                Enabled
                            </span>
                        ) : (
                            <span class="qdt-badge qdt-badge-off">
                                <span class="qdt-badge-dot" />
                                Disabled
                            </span>
                        )}
                    </div>

                    {store.$persist && (
                        <button
                            class="qdt-btn qdt-btn-danger"
                            onClick={async () => {
                                if (
                                    confirm(
                                        'Clear persisted data for this store?',
                                    )
                                ) {
                                    try {
                                        await store.$persist.clear();
                                        alert('Storage cleared.');
                                    } catch (e) {
                                        console.error(e);
                                        alert('Failed to clear storage.');
                                    }
                                }
                            }}
                            title="Clear persisted data"
                        >
                            <Icon name="trash" size={12} />
                            Clear Storage
                        </button>
                    )}
                </div>

                <div class="qdt-row">
                    <span
                        style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                        }}
                    >
                        Reset in-memory state to initial values.
                    </span>
                    <button
                        class="qdt-btn"
                        onClick={() => {
                            if (
                                confirm(
                                    'Reset state? This will revert all changes.',
                                )
                            ) {
                                store.$reset();
                            }
                        }}
                    >
                        <Icon name="rotate-ccw" size={12} />
                        Reset State
                    </button>
                </div>
            </div>

            {/* State */}
            <div class="qdt-card">
                <div class="qdt-card-title">State</div>
                <div class="qdt-json">
                    <JSONValue value={store.state} depth={0} />
                </div>
            </div>

            {/* Getters */}
            <div class="qdt-card">
                <div class="qdt-card-title">Getters</div>
                {store.getters && Object.keys(store.getters).length > 0 ? (
                    <div class="qdt-json">
                        {Object.entries(store.getters).map(
                            ([key, getter]: [string, any]) => (
                                <div class="qdt-json-row" key={key}>
                                    <span class="qdt-json-key">{key}</span>
                                    <span class="qdt-json-colon">: </span>
                                    <span class="qdt-json-number">
                                        {safeSerializeCompact(getter.value)}
                                    </span>
                                </div>
                            ),
                        )}
                    </div>
                ) : (
                    <div
                        style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            fontStyle: 'italic',
                        }}
                    >
                        No getters defined
                    </div>
                )}
            </div>

            {/* Actions */}
            {store.actions && Object.keys(store.actions).length > 0 && (
                <div class="qdt-card">
                    <div class="qdt-card-title">Actions</div>
                    {Object.keys(store.actions).map((key) => (
                        <div class="qdt-action-item" key={key}>
                            <span class="qdt-action-fn">{key}()</span>
                            <button
                                class="qdt-btn-ghost"
                                onClick={() => {
                                    try {
                                        store.actions[key]();
                                    } catch (e) {
                                        console.error(e);
                                        alert(`Action failed: ${e}`);
                                    }
                                }}
                                title="Trigger Action"
                            >
                                <Icon name="play" size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
