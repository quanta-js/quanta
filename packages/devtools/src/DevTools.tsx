import { useState } from 'preact/hooks';
import logo from './public/logo.svg';
import { useDevToolsBridge } from './hooks/useDevToolsBridge';
import { StoreInspector } from './components/StoreInspector';
import { ActionLog } from './components/ActionLog';
import Icon from './components/ui/icon';
import packageJson from '../package.json';

export function DevTools() {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'inspector' | 'actions'>(
        'inspector',
    );
    const { stores, actions, selectedStore, setSelectedStore } =
        useDevToolsBridge();

    // Filter stores based on search query
    const filteredStores = Object.keys(stores).filter((storeName) =>
        storeName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const actionsCount = actions.length;
    const quantaVersion = packageJson.version;

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    background: '#000',
                    color: '#fff',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                    border: '1px solid rgb(51 65 85)',
                    borderRadius: '9999px',
                    overflow: 'hidden',
                    transition: 'all 300ms ease-out',
                    zIndex: '9999',
                    width: '48px',
                    height: '48px',
                    cursor: 'pointer',
                    padding: '0',
                    paddingLeft: '4px',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.width = '200px';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.width = '48px';
                }}
                title="Open Quanta DevTools"
            >
                <div style={{
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    flexShrink: '0'
                }}>
                    <img
                        src={logo}
                        alt="Quanta DevTools"
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '9999px',
                            objectFit: 'cover'
                        }}
                    />
                </div>

                <span style={{
                    whiteSpace: 'nowrap',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'rgba(56,178,172,1)',
                    marginLeft: '8px'
                }}>
                    QuantaJS DevTools
                </span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-[92vw] max-w-[980px] h-[80vh] md:h-[600px] bg-[#0f172a] shadow-2xl border border-slate-800 rounded-xl flex flex-col z-[9999] overflow-hidden">
            <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[rgba(255,255,255,0.02)]">
                <div className="flex items-center gap-3">
                    <img
                        src={logo}
                        alt="Quanta DevTools"
                        className="w-10 h-10 rounded-full"
                    />
                    <div>
                        <div className="text-sm font-semibold text-[rgba(56,178,172,1)]">
                            QuantaJS DevTools
                        </div>
                        <div className="text-xs text-slate-400">
                            Inspect stores, replay actions & manage persistence
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-900/30 px-2 py-1 rounded">
                        <button
                            className={`px-3 py-1 text-xs uppercase tracking-wider rounded ${activeTab === 'inspector' ? 'text-[rgba(56,178,172,1)] bg-slate-800/40 border border-slate-400' : 'text-slate-400 hover:text-slate-200 bg-transparent'}`}
                            onClick={() => setActiveTab('inspector')}
                        >
                            Inspector
                        </button>
                        <button
                            className={`px-3 py-1 text-xs uppercase tracking-wider rounded ${activeTab === 'actions' ? 'text-[rgba(56,178,172,1)] bg-slate-800/40 border border-slate-400' : 'text-slate-400 hover:text-slate-200 bg-transparent'}`}
                            onClick={() => setActiveTab('actions')}
                        >
                            Actions ({actionsCount})
                        </button>
                    </div>

                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1 bg-transparent rounded-full transition text-red-500 hover:text-red-600"
                        title="Close"
                    >
                        <Icon name="circle-x" size={24} />
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-56 border-r border-slate-800 p-3 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <Icon
                            name="search"
                            size={18}
                            className="text-slate-400 flex-shrink-0"
                        />
                        <input
                            placeholder="Filter stores..."
                            className="p-1 flex-1 bg-transparent rounded-md outline-none text-sm text-slate-200 placeholder:text-slate-500"
                            onInput={(e: any) => setSearchQuery(e.target.value)}
                            type="search"
                            value={searchQuery}
                        />
                    </div>

                    <div className="flex-1 overflow-auto">
                        {Object.keys(stores).length === 0 ? (
                            <div className="text-xs text-slate-500">
                                No stores detected
                            </div>
                        ) : filteredStores.length === 0 ? (
                            <div className="text-xs text-slate-500">
                                No stores match "{searchQuery}"
                            </div>
                        ) : (
                            filteredStores.map((name) => (
                                <button
                                    key={name}
                                    onClick={() => setSelectedStore(name)}
                                    className={`w-full mb-1 text-left px-3 py-2 rounded-md flex items-center gap-2 transition ${selectedStore === name ? 'text-[rgba(56,178,172,1)] hover:text-slate-100 bg-[rgba(255,255,255,0.02)]' : 'text-slate-400 hover:text-slate-200 bg-transparent'}`}
                                    title={name}
                                >
                                    <Icon
                                        name="database"
                                        size={16}
                                        className="text-slate-400 flex-shrink-0"
                                    />
                                    <div className="flex-1 text-sm truncate">
                                        {name}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="flex-1">
                            {filteredStores.length}{searchQuery ? `/${Object.keys(stores).length}` : ''} {filteredStores.length === 1 ? 'store' : 'stores'}
                        </div>
                        <div className="text-right">v{quantaVersion}</div>
                    </div>
                </aside>

                <main className="flex-1 overflow-auto space-y-4">
                    {activeTab === 'inspector' ? (
                        <StoreInspector
                            stores={stores}
                            selectedStore={selectedStore}
                            onClose={() => setIsOpen(false)}
                        />
                    ) : (
                        <ActionLog actions={actions} />
                    )}
                </main>
            </div>
        </div>
    );
}
