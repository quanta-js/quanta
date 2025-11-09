export interface PersistenceAdapter {
    key: string;
    read(): Promise<any> | any;
    write(data: any): Promise<void> | void;
    remove(): Promise<void> | void;
    subscribe?(callback: (data: any) => void): () => void; // Cross-tab sync
}

export interface PersistenceConfig<T = any> {
    adapter: PersistenceAdapter;
    serialize?: (data: T) => string;
    deserialize?: (data: string) => T;
    migrations?: Record<number, (data: any) => any>;
    version?: number;
    debounceMs?: number;
    include?: Array<keyof T>;
    exclude?: Array<keyof T>;
    transform?: {
        in?: (data: any) => any; // Transform when loading
        out?: (data: any) => any; // Transform when saving
    };
    onError?: (
        error: Error,
        operation: 'read' | 'write' | 'remove' | 'watch-setup',
    ) => void;
    validator?: (data: any) => boolean;
}

export interface PersistedData<T = any> {
    data: T;
    version: number;
    timestamp: number;
    storeName?: string;
    checksum?: string;
}

export interface PersistenceManager {
    save(): Promise<void>;
    load(): Promise<void>;
    clear(): Promise<void>;
    getAdapter(): PersistenceAdapter;
    isRehydrated(): boolean;
    destroy(): void;
}
