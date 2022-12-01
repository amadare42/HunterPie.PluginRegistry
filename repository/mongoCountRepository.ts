import { Collection, MongoClient, Db } from 'mongodb';
import { PluginsCountRepository } from './pluginsCountRepository';

export interface InstallEntry {
    plugin: string,
    installs: number
}

export class MongoCountRepository implements PluginsCountRepository {
    private client: MongoClient;
    private collectionPromise: Promise<Collection>;
    private db: Db | undefined;

    constructor(connectionString: string) {
        this.client = new MongoClient(connectionString);
        this.collectionPromise = this.client
            .connect()
            .then(() => {
                this.db = this.client.db(this.client.options.dbName || 'pluginRepository');
                return this.db.collection('installs');
            });
    }

    async applyImport(name: string, installs: InstallEntry[]) {
        const installsCollection = await this.collectionPromise;
        let importsCollection = this.db!.collection('imports');
        const existingImport = await importsCollection.findOne({ name });
        if (existingImport) {
            return { error: "Import cancelled because import with same name exists" };
        }

        const bulk = await installsCollection.initializeUnorderedBulkOp();
        for (let install of installs) {
            bulk.find({ plugin: install.plugin })
                .upsert()
                .updateOne(
                    { $inc: { installs: install.installs }, $set: { plugin: install.plugin } }
                );
        }
        await importsCollection.insertOne({ installs, name });
        let r = await bulk.execute();
        return r.toJSON();
    }

    async get(pluginName: string) {
        const collection = await this.collectionPromise;
        const value = await collection.findOne({ plugin: pluginName });
        return value?.installs || 0;
    }

    async set(pluginName: string, installs: number) {
        const collection = await this.collectionPromise;
        await collection.updateOne({ plugin: pluginName }, { $set: { pluginName, installs }}, { upsert: true });
    }

    async inc(pluginName: string) {
        const collection = await this.collectionPromise;
        await collection.updateOne({ plugin: pluginName }, {
            $inc: { installs: 1 },
            $set: { plugin: pluginName }
        }, { upsert: true });
        const updated = await collection.findOne({ plugin: pluginName });
        return updated?.installs || 0;
    }
}
