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

    const filteredStores = Object.keys(stores).filter((name) =>
        name.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const actionsCount = actions.length;
    const quantaVersion = packageJson.version;

    if (!isOpen) {
        return (
            <button
                class="qdt-fab"
                onClick={() => setIsOpen(true)}
                title="Open QuantaJS DevTools"
            >
                <img src={logo} alt="" class="qdt-fab-logo" />
                <span class="qdt-fab-label">QuantaJS</span>
            </button>
        );
    }

    return (
        <div class="qdt-panel">
            {/* Header */}
            <header class="qdt-header">
                <div class="qdt-header-left">
                    <img src={logo} alt="" class="qdt-header-logo" />
                    <div>
                        <div class="qdt-header-title">QuantaJS DevTools</div>
                        <div class="qdt-header-subtitle">
                            Inspect stores & replay actions
                        </div>
                    </div>
                </div>

                <div class="qdt-header-right">
                    <div class="qdt-tabs">
                        <button
                            class="qdt-tab"
                            data-active={activeTab === 'inspector'}
                            onClick={() => setActiveTab('inspector')}
                        >
                            Inspector
                        </button>
                        <button
                            class="qdt-tab"
                            data-active={activeTab === 'actions'}
                            onClick={() => setActiveTab('actions')}
                        >
                            Actions
                            {actionsCount > 0 && (
                                <span class="qdt-tab-badge">
                                    {actionsCount}
                                </span>
                            )}
                        </button>
                    </div>

                    <button
                        class="qdt-close"
                        onClick={() => setIsOpen(false)}
                        title="Close"
                    >
                        <Icon name="circle-x" size={18} />
                    </button>
                </div>
            </header>

            {/* Body */}
            <div class="qdt-body">
                {/* Sidebar */}
                <aside class="qdt-sidebar">
                    <div class="qdt-search">
                        <Icon name="search" size={14} />
                        <input
                            type="search"
                            placeholder="Filter stores..."
                            value={searchQuery}
                            onInput={(e: any) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div class="qdt-store-list">
                        {Object.keys(stores).length === 0 ? (
                            <div
                                class="qdt-empty"
                                style={{ height: 'auto', padding: '20px 10px' }}
                            >
                                <Icon name="database" size={20} />
                                <span>No stores detected</span>
                            </div>
                        ) : filteredStores.length === 0 ? (
                            <div
                                class="qdt-empty"
                                style={{ height: 'auto', padding: '20px 10px' }}
                            >
                                <span>No match for "{searchQuery}"</span>
                            </div>
                        ) : (
                            filteredStores.map((name) => (
                                <button
                                    key={name}
                                    class="qdt-store-item"
                                    data-active={selectedStore === name}
                                    onClick={() => setSelectedStore(name)}
                                    title={name}
                                >
                                    <Icon name="database" size={14} />
                                    <span class="qdt-store-name">{name}</span>
                                </button>
                            ))
                        )}
                    </div>

                    <div class="qdt-sidebar-footer">
                        <span>
                            {filteredStores.length}
                            {searchQuery
                                ? `/${Object.keys(stores).length}`
                                : ''}{' '}
                            {filteredStores.length === 1 ? 'store' : 'stores'}
                        </span>
                        <span>v{quantaVersion}</span>
                    </div>
                </aside>

                {/* Main */}
                <main class="qdt-main">
                    {activeTab === 'inspector' ? (
                        <StoreInspector
                            stores={stores}
                            selectedStore={selectedStore}
                        />
                    ) : (
                        <ActionLog actions={actions} />
                    )}
                </main>
            </div>
        </div>
    );
}
