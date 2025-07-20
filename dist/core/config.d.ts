/**
 * Configuration loading and validation system
 */
import { GhostCommentConfig } from '../models/comment.js';
import { CLIOptions } from '../models/config.js';
/**
 * Loads complete configuration from all sources
 *
 * @param options - CLI options (highest priority)
 * @param workingDirectory - Directory to search for config files
 * @returns Promise resolving to complete configuration
 */
export declare function loadConfig(options?: CLIOptions, workingDirectory?: string): Promise<GhostCommentConfig>;
/**
 * Validates configuration without loading from files
 *
 * @param config - Configuration object to validate
 * @returns Validation result
 */
export declare function validateConfigOnly(config: Partial<GhostCommentConfig>): {
    valid: boolean;
    errors: string[];
};
/**
 * Creates a default configuration file
 *
 * @param workingDirectory - Directory to create config file in
 * @param fileName - Name of config file to create
 * @returns Promise resolving to path of created file
 */
export declare function createDefaultConfigFile(workingDirectory?: string, fileName?: string): Promise<string>;
//# sourceMappingURL=config.d.ts.map