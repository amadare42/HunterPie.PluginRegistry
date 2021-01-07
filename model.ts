export interface Module {
    Name: string;
    DisplayName?: string;
    Description?: string;
    Author?: string;
    Version: string;
    Dependencies?: string[];
    Update?: {
        UpdateUrl: string;
        MinimumVersion?: string;
        FileHashes: { [key: string]: string }
    }
}

export interface RegistryEntry {
    InternalName: string,
    ImageUrl?: string,
    Readme?: string,
    Module: string
}

export interface PluginInfo extends RegistryEntry {
    DisplayName: string,
    Description: string,
    Author: string,
    Version: string
    MinVersion: string;
    Downloads: number;
}
