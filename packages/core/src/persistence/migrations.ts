import { logger } from '../services/logger-service';
import type { PersistenceConfig } from '../type/persistence-types';

/**
 * Migration function type
 */
export type MigrationFunction<T = any> = (data: any) => T;

/**
 * Migration definition
 */
export interface MigrationDefinition<T = any> {
    version: number;
    migrate: MigrationFunction<T>;
    description?: string;
}

/**
 * Migration manager for handling schema changes
 */
export class MigrationManager<T = any> {
    private migrations: Map<number, MigrationFunction<T>> = new Map();

    constructor(migrations: MigrationDefinition<T>[] = []) {
        migrations.forEach((migration) => {
            this.addMigration(migration.version, migration.migrate);
        });
    }

    /**
     * Add a migration function for a specific version
     */
    addMigration(version: number, migrate: MigrationFunction<T>): void {
        this.migrations.set(version, migrate);
        logger.log(`Migration: Added migration for version ${version}`);
    }

    /**
     * Remove a migration for a specific version
     */
    removeMigration(version: number): void {
        const hadMigration = this.migrations.has(version);
        this.migrations.delete(version);
        if (hadMigration) {
            logger.log(`Migration: Removed migration for version ${version}`);
        } else {
            logger.warn(
                `Migration: No migration found for version ${version} to remove`,
            );
        }
    }

    /**
     * Get all available migration versions
     */
    getVersions(): number[] {
        return Array.from(this.migrations.keys()).sort((a, b) => a - b);
    }

    /**
     * Check if a migration exists for a specific version
     */
    hasMigration(version: number): boolean {
        return this.migrations.has(version);
    }

    /**
     * Get the highest migration version
     */
    getHighestVersion(): number {
        const versions = this.getVersions();
        return versions.length > 0 ? Math.max(...versions) : 0;
    }

    /**
     * Apply migrations from current version to target version
     */
    migrate(data: any, fromVersion: number, toVersion: number): any {
        if (fromVersion === toVersion) {
            return data;
        }

        if (fromVersion > toVersion) {
            throw new Error(
                `Cannot migrate from version ${fromVersion} to ${toVersion} (downgrade not supported)`,
            );
        }

        logger.log(
            `Migration: Starting migration from version ${fromVersion} to ${toVersion}`,
        );

        let migratedData = data;

        // Apply migrations in order
        for (let version = fromVersion + 1; version <= toVersion; version++) {
            const migration = this.migrations.get(version);
            if (migration) {
                try {
                    logger.log(
                        `Migration: Applying migration for version ${version}`,
                    );
                    migratedData = migration(migratedData);
                    logger.log(
                        `Migration: Successfully applied migration for version ${version}`,
                    );
                } catch (error) {
                    const errorMessage = `Migration ${version} failed: ${error instanceof Error ? error.message : String(error)}`;
                    logger.warn(errorMessage);
                    throw new Error(errorMessage);
                }
            } else {
                logger.log(
                    `Migration: No migration found for version ${version}, skipping`,
                );
            }
        }

        logger.log(
            `Migration: Successfully completed migration from version ${fromVersion} to ${toVersion}`,
        );

        return migratedData;
    }

    /**
     * Validate that all migrations can be applied successfully
     */
    validateMigrations(): { valid: boolean; errors: string[] } {
        logger.log('Migration: Starting migration validation...');
        const errors: string[] = [];
        const versions = this.getVersions();

        if (versions.length === 0) {
            logger.log('Migration: No migrations to validate');
            return { valid: true, errors: [] };
        }

        logger.log(`Migration: Validating ${versions.length} migrations`);

        // Test migrations with sample data
        const testData = { test: true };

        for (let i = 0; i < versions.length - 1; i++) {
            const currentVersion = versions[i];
            const nextVersion = versions[i + 1];

            try {
                logger.log(
                    `Migration: Testing migration from version ${currentVersion} to ${nextVersion}`,
                );
                this.migrate(testData, currentVersion, nextVersion);
                logger.log(
                    `Migration: Successfully validated migration from version ${currentVersion} to ${nextVersion}`,
                );
            } catch (error) {
                const errorMessage = `Migration from ${currentVersion} to ${nextVersion} failed: ${error instanceof Error ? error.message : String(error)}`;
                logger.warn(errorMessage);
                errors.push(errorMessage);
            }
        }

        const isValid = errors.length === 0;
        if (isValid) {
            logger.log('Migration: All migrations validated successfully');
        } else {
            logger.warn(
                `Migration: Validation failed with ${errors.length} errors`,
            );
        }

        return {
            valid: isValid,
            errors,
        };
    }
}

/**
 * Create a migration manager from a configuration object
 */
export function createMigrationManager<T = any>(
    config: Pick<PersistenceConfig<T>, 'migrations' | 'version'>,
): MigrationManager<T> {
    const manager = new MigrationManager<T>();

    if (config.migrations) {
        logger.log(
            `Migration: Creating migration manager with ${Object.keys(config.migrations).length} migrations`,
        );
        Object.entries(config.migrations).forEach(([versionStr, migrate]) => {
            const version = parseInt(versionStr, 10);
            if (!isNaN(version)) {
                manager.addMigration(version, migrate);
            } else {
                logger.warn(
                    `Migration: Invalid version number "${versionStr}", skipping`,
                );
            }
        });
    } else {
        logger.log('Migration: Creating migration manager with no migrations');
    }

    return manager;
}

/**
 * Common migration patterns
 */
export const CommonMigrations = {
    /**
     * Add a new property with default value
     */
    addProperty<T extends Record<string, any>, K extends string, V>(
        property: K,
        defaultValue: V,
    ): MigrationFunction<T & Record<K, V>> {
        return (data: T) => {
            logger.log(
                `Migration: Added property "${String(property)}" with default value:`,
                defaultValue,
            );
            return {
                ...data,
                [property]: defaultValue,
            };
        };
    },

    /**
     * Remove a property
     */
    removeProperty<T extends Record<string, any>, K extends keyof T>(
        property: K,
    ): MigrationFunction<Omit<T, K>> {
        return (data: T) => {
            const { [property]: removed, ...rest } = data;
            // Log the removed property for debugging purposes (browser-safe)
            logger.log(
                `Migration: Removed property "${String(property)}" with value:`,
                removed,
            );
            return rest;
        };
    },

    /**
     * Rename a property
     */
    renameProperty<
        T extends Record<string, any>,
        K extends keyof T,
        N extends string,
    >(oldName: K, newName: N): MigrationFunction<Omit<T, K> & Record<N, T[K]>> {
        return (data: T) => {
            const { [oldName]: value, ...rest } = data;
            logger.log(
                `Migration: Renamed property "${String(oldName)}" to "${String(newName)}" with value:`,
                value,
            );
            return {
                ...(rest as Omit<T, K>),
                [newName]: value as T[K],
            } as Omit<T, K> & Record<N, T[K]>;
        };
    },

    /**
     * Transform a property value
     */
    transformProperty<T extends Record<string, any>, K extends keyof T>(
        property: K,
        transform: (value: T[K]) => any,
    ): MigrationFunction<T> {
        return (data: T) => {
            const oldValue = data[property];
            const newValue = transform(oldValue);
            logger.log(
                `Migration: Transformed property "${String(property)}" from:`,
                oldValue,
                'to:',
                newValue,
            );
            return {
                ...data,
                [property]: newValue,
            };
        };
    },
};
