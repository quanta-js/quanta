import { useState } from 'preact/hooks';
import logo from './public/logo.svg';
import { useDevToolsBridge } from './hooks/useDevToolsBridge';
import { StoreInspector } from './components/StoreInspector';
import { ActionLog } from './components/ActionLog';
import Icon from './components/ui/icon';
import packageJson from '../package.json';

export function DevTools() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'inspector' | 'actions'>(
        'inspector',
    );
    const { stores, actions, selectedStore, setSelectedStore } =
        useDevToolsBridge();

    const actionsCount = actions.length;
    const quantaVersion = packageJson.version;

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 flex items-center bg-black text-white shadow-xl border border-slate-700 rounded-full overflow-hidden transition-all duration-300 ease-out group z-[9999] w-12 hover:w-46 h-12"
                title="Open Quanta DevTools"
            >
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                    <img
                        src={logo}
                        alt="Quanta DevTools"
                        className="w-10 h-10 rounded-full object-cover"
                    />
                </div>

                <span className="opacity-0 group-hover:opacity-100 whitespace-nowrap text-sm font-medium text-[rgba(56,178,172,1)] transition-opacity duration-300">
                    QuantaJS DevTools
                </span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-[92vw] max-w-[980px] h-[80vh] md:h-[600px] bg-gradient-to-b from-[#071123] to-[#0b1220] shadow-2xl border border-slate-800 rounded-xl flex flex-col z-[9999] overflow-hidden">
            <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[rgba(255,255,255,0.02)]">
                <div className="flex items-center gap-3">
                    <img
                        src={logo}
                        alt="Quanta DevTools"
                        className="w-6 h-6 rounded-full"
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
                            className={`px-3 py-1 text-xs uppercase tracking-wider rounded ${activeTab === 'inspector' ? 'text-[rgba(56,178,172,1)] bg-slate-800/40' : 'text-slate-400 hover:text-slate-200 bg-transparent'}`}
                            onClick={() => setActiveTab('inspector')}
                        >
                            Inspector
                        </button>
                        <button
                            className={`px-3 py-1 text-xs uppercase tracking-wider rounded ${activeTab === 'actions' ? 'text-[rgba(56,178,172,1)] bg-slate-800/40' : 'text-slate-400 hover:text-slate-200 bg-transparent'}`}
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
                <aside className="w-56 bg-[rgba(255,255,255,0.02)] border-r border-slate-800 p-3 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <Icon
                            name="search"
                            size={14}
                            className="text-slate-400"
                        />
                        <input
                            placeholder="Filter stor    es..."
                            className="p-1 flex-1 bg-transparent rounded-md outline-none text-sm text-slate-200 placeholder:text-slate-500"
                            onInput={(e: any) =>
                                setSelectedStore(e.target.value)
                            }
                            value={selectedStore ?? ''}
                        />
                    </div>

                    <div className="flex-1 overflow-auto">
                        {Object.keys(stores).length === 0 ? (
                            <div className="text-xs text-slate-500">
                                No stores detected
                            </div>
                        ) : (
                            Object.keys(stores).map((name) => (
                                <button
                                    key={name}
                                    onClick={() => setSelectedStore(name)}
                                    className={`w-full mb-1 text-left px-3 py-2 rounded-md flex items-center gap-2 transition ${selectedStore === name ? 'text-[rgba(56,178,172,1)] hover:text-slate-100 bg-[rgba(255,255,255,0.02)]' : 'text-slate-400 hover:text-slate-200 bg-transparent'}`}
                                >
                                    <span className="font-mono text-xs text-slate-400">
                                        <Icon
                                            name="database"
                                            size={14}
                                            className="text-slate-400"
                                        />
                                    </span>
                                    <div className="flex-1 text-sm truncate">
                                        {name}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="flex-1">
                            {Object.keys(stores).length} stores
                        </div>
                        <div className="text-right">v{quantaVersion}</div>
                    </div>
                </aside>

                <main className="flex-1 overflow-auto p-4 space-y-4">
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
