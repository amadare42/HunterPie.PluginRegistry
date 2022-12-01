import { MongoCountRepository } from './mongoCountRepository';

describe("MongoCountRepository", () => {
    require('dotenv').config();

    it("inc", async () => {
        const sut = new MongoCountRepository(process.env.MONGO_CONNECTION_STRING);
        console.log(await sut.inc("mockplugin"));
    });

    it("get", async () => {
        const sut = new MongoCountRepository(process.env.MONGO_CONNECTION_STRING);
        console.log(await sut.get("mockplugin"));
    });

    it("applyImport", async () => {
        const sut = new MongoCountRepository(process.env.MONGO_CONNECTION_STRING);
        console.log(await sut.applyImport("test", [{ plugin: "mockplugin", installs: 2 }]));
    });
})
