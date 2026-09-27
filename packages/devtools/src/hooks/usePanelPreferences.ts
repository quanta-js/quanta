import { useEffect, useState } from 'preact/hooks';

type PanelPreferences = {
    isOpen: boolean;
    activeTab: 'inspector' | 'actions';
};

const STORAGE_KEY = 'quanta-devtools:ui';

function readPreferences(): PanelPreferences {
    const defaults: PanelPreferences = {
        isOpen: false,
        activeTab: 'inspector',
    };
    try {
        const saved: unknown = JSON.parse(
            localStorage.getItem(STORAGE_KEY) ?? 'null',
        );
        if (!saved || typeof saved !== 'object' || Array.isArray(saved))
            return defaults;
        const value = saved as Record<string, unknown>;
        return {
            isOpen:
                typeof value.isOpen === 'boolean'
                    ? value.isOpen
                    : defaults.isOpen,
            activeTab:
                value.activeTab === 'actions' || value.activeTab === 'inspector'
                    ? value.activeTab
                    : defaults.activeTab,
        };
    } catch {
        return defaults;
    }
}

export function usePanelPreferences() {
    const [preferences, setPreferences] = useState(readPreferences);
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
        } catch {
            // Blocked or full storage must not prevent using the panel.
        }
    }, [preferences]);

    return {
        ...preferences,
        setIsOpen: (isOpen: boolean) =>
            setPreferences((prev) => ({ ...prev, isOpen })),
        setActiveTab: (activeTab: PanelPreferences['activeTab']) =>
            setPreferences((prev) => ({ ...prev, activeTab })),
    };
}
