import * as redis from 'redis';
import { RedisClient } from 'redis';
import { promisify } from 'util';
import { PluginsCountRepository } from './pluginsCountRepository';

// "Thank you", official redis library that doesn't support promises in 2021 -_-
function bind<T extends Function>(fn: Function, obj: any) {
    return fn.bind(obj) as T;
}

interface ConnectedRedisRepo {
    client: RedisClient;
    redisGet: (key: string) => Promise<string>;
    redisSet: (key: string, value: string) => Promise<string>;
}

export class RedisCountRepository implements PluginsCountRepository {
    private connectionPromise: Promise<ConnectedRedisRepo>;

    constructor(private connectionString: string) {
    }

    private getRepo() {
        if (this.connectionPromise) return this.connectionPromise;
        return this.connectionPromise = new Promise<ConnectedRedisRepo>(r => {
            const client = redis.createClient(this.connectionString);

            const redisGet = bind(promisify(client.get), client) as any;
            const redisSet = bind(promisify(client.set), client) as any;
            r({ client, redisSet, redisGet })
        });
    }

    async get(pluginName: string) {
        const { redisGet } = await this.getRepo();
        var result = await redisGet(`installs:${ pluginName }`);
        let val = parseInt(result);
        if (isNaN(val)) {
            val = 0;
        }
        return val;
    }

    async set(pluginName: string, value: number) {
        const { redisSet } = await this.getRepo();
        await redisSet(`installs:${ pluginName }`, value.toString());
    }

    async inc(pluginName: string) {
        // isn't properly transactional, but who cares
        const value = await this.get(pluginName);
        await this.set(pluginName, value + 1);
        return value + 1;
    }

    async getInstalls() {
        const { client } = await this.getRepo();
        const keys: string[] = await bind(promisify(client.keys), client)("installs:*");
        const values: string[] = await bind(promisify(client.mget), client)(keys);
        const result = keys.map((key, i) => ({ plugin: key.substring("installs:".length), installs: parseInt(values[i]) }));
        return result;
    }
}
