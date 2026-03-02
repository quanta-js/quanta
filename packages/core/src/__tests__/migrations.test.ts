import { describe, it, expect } from 'vitest';
import {
    MigrationManager,
    createMigrationManager,
    CommonMigrations,
} from '../persistence/migrations';

describe('MigrationManager', () => {
    it('should create with initial migrations', () => {
        const manager = new MigrationManager([
            { version: 1, migrate: (d: any) => d },
            { version: 2, migrate: (d: any) => ({ ...d, v2: true }) },
        ]);

        expect(manager.hasMigration(1)).toBe(true);
        expect(manager.hasMigration(2)).toBe(true);
    });

    it('should add and remove migrations', () => {
        const manager = new MigrationManager();
        manager.addMigration(1, (d: any) => d);

        expect(manager.hasMigration(1)).toBe(true);

        manager.removeMigration(1);
        expect(manager.hasMigration(1)).toBe(false);
    });

    it('should get versions in sorted order', () => {
        const manager = new MigrationManager([
            { version: 3, migrate: (d: any) => d },
            { version: 1, migrate: (d: any) => d },
            { version: 2, migrate: (d: any) => d },
        ]);

        expect(manager.getVersions()).toEqual([1, 2, 3]);
    });

    it('should get highest version', () => {
        const manager = new MigrationManager([
            { version: 5, migrate: (d: any) => d },
            { version: 2, migrate: (d: any) => d },
        ]);

        expect(manager.getHighestVersion()).toBe(5);
    });

    it('should return 0 for empty manager highest version', () => {
        const manager = new MigrationManager();
        expect(manager.getHighestVersion()).toBe(0);
    });

    it('should apply migrations in order', () => {
        const manager = new MigrationManager([
            { version: 2, migrate: (d: any) => ({ ...d, v2: true }) },
            { version: 3, migrate: (d: any) => ({ ...d, v3: true }) },
        ]);

        const result = manager.migrate({ base: true }, 1, 3);
        expect(result).toEqual({ base: true, v2: true, v3: true });
    });

    it('should return data unchanged for same version', () => {
        const manager = new MigrationManager();
        const data = { x: 1 };

        expect(manager.migrate(data, 3, 3)).toBe(data);
    });

    it('should throw for downgrade', () => {
        const manager = new MigrationManager();

        expect(() => manager.migrate({}, 3, 1)).toThrow(/downgrade/);
    });

    it('should skip missing migration versions', () => {
        const manager = new MigrationManager([
            { version: 3, migrate: (d: any) => ({ ...d, v3: true }) },
            // Version 2 is missing — should be skipped
        ]);

        const result = manager.migrate({ base: true }, 1, 3);
        expect(result).toEqual({ base: true, v3: true });
    });

    it('should validate migrations', () => {
        const manager = new MigrationManager([
            { version: 1, migrate: (d: any) => d },
            { version: 2, migrate: (d: any) => ({ ...d, v2: true }) },
        ]);

        const result = manager.validateMigrations();
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });
});

describe('createMigrationManager', () => {
    it('should create from config with numbered migrations', () => {
        const manager = createMigrationManager({
            version: 3,
            migrations: {
                2: (d: any) => ({ ...d, v2: true }),
                3: (d: any) => ({ ...d, v3: true }),
            },
        });

        expect(manager.hasMigration(2)).toBe(true);
        expect(manager.hasMigration(3)).toBe(true);
    });

    it('should handle empty migrations', () => {
        const manager = createMigrationManager({ version: 1 });
        expect(manager.getVersions()).toEqual([]);
    });
});

describe('CommonMigrations', () => {
    it('addProperty should add with default value', () => {
        const migrate = CommonMigrations.addProperty('newProp', 'default');
        const result = migrate({ existing: 1 });

        expect(result).toEqual({ existing: 1, newProp: 'default' });
    });

    it('removeProperty should remove a property', () => {
        const migrate = CommonMigrations.removeProperty('toRemove');
        const result = migrate({ keep: 1, toRemove: 2 });

        expect(result).toEqual({ keep: 1 });
    });

    it('renameProperty should rename a property', () => {
        const migrate = CommonMigrations.renameProperty('old', 'renamed');
        const result = migrate({ old: 'value', other: 1 });

        expect(result).toEqual({ renamed: 'value', other: 1 });
    });

    it('transformProperty should transform a value', () => {
        const migrate = CommonMigrations.transformProperty(
            'count',
            (v: number) => v * 10,
        );
        const result = migrate({ count: 5 });

        expect(result).toEqual({ count: 50 });
    });
});
