export interface PluginsCountRepository {
    get(pluginName: string): Promise<number>;
    set(pluginName: string, value: number): Promise<void>;
    inc(pluginName: string): Promise<number>;
}
