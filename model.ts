/**
 * module.json type
 */
export interface Module {
    Name: string;
    DisplayName?: string;
    Description?: string;
    Author?: string;
    Version: string;
    Dependencies?: string[];
    Links?: string[];
    ImageUrl: string;
    ReleaseDate?: string;
    Update?: {
        UpdateUrl: string;
        MinimumVersion?: string;
        FileHashes: { [key: string]: string }
    }
}

/**
 * Model in registry.json
 */
export interface RegistryEntry {
    InternalName: string,
    ImageUrl?: string,
    Readme?: string,
    Module: string,
    ReleaseDate?: string;
}

/**
 * Cached version of module from registry.json populated with values from module.json.
 */
export interface PluginInfo extends RegistryEntry {
    DisplayName: string,
    Description: string,
    Author: string,
    Version: string
    MinVersion: string;
    Downloads: number;
    Links?: string[];
    ReleaseDate?: string;
}
