import { RedisCountRepository } from './redisCountRepository';

describe("RedisCountRepository", () => {
    require('dotenv').config();

    it("get", async () => {
        const sut = new RedisCountRepository(process.env.REDISCLOUD_URL);
        console.log(await sut.get("Plugin.Sync"));
    });

    it("inc", async () => {
        const sut = new RedisCountRepository(process.env.REDISCLOUD_URL);
        console.log(await sut.inc("Plugin.Sync"));
    });

    it("getInstalls", async () => {
        const sut = new RedisCountRepository(process.env.REDISCLOUD_URL);
        console.log(await sut.getInstalls());
    });
    it("will not fail if connection failed but no requests done", async () => {
        const sut = new RedisCountRepository("invalid");
        await new Promise(r => setTimeout(r, 4000));
    });
})
