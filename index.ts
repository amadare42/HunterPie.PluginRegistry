import * as express from 'express';
import { getLastUrlPart, removeUrlLastPart, trim } from './util';
import * as https from 'https';
import { PassThrough, Readable } from 'stream';
import { IncomingMessage } from 'http';
import axios from 'axios';
import { Module, PluginInfo, RegistryEntry } from './model';
import * as redis from 'redis';
import { promisify } from 'util';

let lastUpdateTime = 0;

const port = process.env.PORT || 5002;
const baseAddress = process.env.HEROKU_APP_NAME
    ? `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`
    : `http://localhost:${port}`;
const updateIntervalSec = process.env.UPDATE_INTERVAL_SEC ? parseInt(process.env.UPDATE_INTERVAL_SEC) : 100;
const redisClient = redis.createClient(process.env.REDISCLOUD_URL);

// "Thank you", official redis library that doesn't support promises in 2021 -_-
function bind<T extends Function>(fn: Function, obj: any) {
    return fn.bind(obj) as T;
}
const redisGet = bind(promisify(redisClient.get), redisClient);
const redisSet = bind(promisify(redisClient.set), redisClient);

const registry = require("./registry.json") as RegistryEntry[];
const plugins = new Map<string, PluginInfo>();
const proxyPlugins = new Map<string, PluginInfo>();

const app = express();
app.set('json spaces', 2);

/**
 * Using module.json stream to update cache data.
 * @param res module.json stream (json string of {@type Module})
*/
function pluginPassThrough(res: IncomingMessage) {
    const copyStream = res.pipe(new PassThrough());
    const chunks = []
    copyStream.on('data', c => chunks.push(c))
    copyStream.on('end', async () => {
        const jsonString = Buffer.concat(chunks).toString('utf8');
        try {
            const plugin = JSON.parse(jsonString) as Module;
            await updateDefaultPluginCache(plugin.Name);
        } catch(e) {
            console.error("Error on updating plugin cache")
            console.log(jsonString);
            throw e;
        }
    });
}

/**
 * Get total downloads count for plugin.
 * @param internalName
 */
async function getDownloads(internalName: string) {
    try {
        let val = parseInt(await redisGet(`installs:${ internalName }`));
        if (isNaN(val)) {
            return 0;
        }
        return val;
    } catch {
        return 0;
    }
}

function getHttp(isHttps: boolean) {
    const pkg = require('follow-redirects');
    return isHttps ? pkg.https : pkg.http;
}

/**
 * Proxy request http request to url.
 * @param url target url
 * @param client_req original client request stream
 * @param client_res original client response stream
 * @param cb passthgough handler
 */
async function proxyGet(url: string, client_req: express.Request, client_res: express.Response, cb?: (res: IncomingMessage) => void) {
    console.log("Proxying request to " + url);

    const proxy = getHttp(url.startsWith("https")).request(url, function (res) {
        client_res.writeHead(res.statusCode, res.headers);
        cb && cb(res);
        res.pipe(client_res, {
            end: true
        });
    });

    client_req.pipe(proxy, {
        end: true
    });
}

/**
 * Download and update plugins cache.
 */
async function updatePluginCache() {
    for (let plugin of registry) {
        await updateDefaultPluginCache(plugin.InternalName);
    }
    for (let name of registry.map(r => r.InternalName)) {
        updateProxyPluginCache(name);
    }
    lastUpdateTime = Date.now();
    console.log("registry updated", Array.from(plugins.values()));
}

/**
 * Download plugin's module.json download to update cached data.
 * @param internalName plugin name
 */
async function updateDefaultPluginCache(internalName: string) {
    const entry = registry.find(r => r.InternalName == internalName);
    try {
        const rsp = await axios.get(entry.Module);
        const module = rsp.data as Module;
        plugins.set(entry.InternalName, {
            ...entry,
            DisplayName: module.DisplayName || module.Name || entry.InternalName,
            Description: module.Description || null,
            Author: module.Author || null,
            Version: module.Version || '0.0',
            MinVersion: module.Update?.MinimumVersion || '0.0',
            Downloads: await getDownloads(entry.InternalName),
            ImageUrl: module.ImageUrl || entry.ImageUrl,
            ReleaseDate: module.ReleaseDate || entry.ReleaseDate
        });
    } catch (e) {
        console.error(`Update plugin '${internalName}' failed:`, e.toString());

        plugins.set(internalName, {
            ...entry,
            DisplayName: entry.InternalName,
            Description: null,
            Author: null,
            Version: '0.0',
            MinVersion: '0.0',
            Downloads: await getDownloads(entry.InternalName)
        });
    }
    updateProxyPluginCache(internalName);
}

/**
 * Update plugin cache for proxy users. Proxy {@type PluginInfo} should have links to proxy links instead of default ones.
 */
function updateProxyPluginCache(internalName: string) {
    const plugin = plugins.get(internalName);
    if (!plugin) return;
    proxyPlugins.set(internalName, {
        ...plugin,

        // readme address isn't saved anywhere in HunterPie, so we could just override path to it when proxy enabled
        Readme: [baseAddress, 'plugin', internalName, 'readme', getLastUrlPart(plugin.Readme)].join('/'),

        // we could potentially override module.json path as well, but then client will lose original update url information,
        // so we don't do this
        // Module: [baseAddress, 'plugin', key, 'module', getLastUrlPart(plugin.Module)].join('/'),
    })
}

/**
 * Proxy download plugin file.
 */
app.get('/plugin/:pluginName/:part/*', async (rq, rs) => {
    await new Promise(r => setTimeout(r, 2000));
    const { pluginName, part } = rq.params;
    const rest = rq.params[0];
    console.log({ pluginName, part, rest });

    const plugin = registry.find(m => m.InternalName == pluginName);
    if (!plugin) {
        rs.status(404).send();
        console.log(`Cannot find plugin with name ${pluginName}`)
        return;
    }
    switch (part.toLowerCase()) {
        case 'readme':
            if (rest.toLowerCase().endsWith('readme.md')) {
                await proxyGet(plugin.Readme, rq, rs);
            } else {
                let url = [trim(removeUrlLastPart(plugin.Readme), '/'), rest].join("/");
                await proxyGet(url, rq, rs);
            }
            return;

        case 'module': {
            let url = [trim(removeUrlLastPart(plugin.Module), '/'), rest].join("/");
            if (url.toLowerCase() == plugin.Module.toLowerCase()) {
                await proxyGet(plugin.Module, rq, rs, pluginPassThrough);
            } else {
                await proxyGet(url, rq, rs);
            }
            return;
        }

        default:
            rs.status(404).send();
    }
});

/**
 * Report plugin installation.
 */
app.post('/plugin/:pluginName/install', async (rq, rs) => {
    if (!registry.some(p => p.InternalName == rq.params.pluginName)) {
        rs.send('Plugin not found')
            .status(404)
        return;
    }
    var result = await redisGet(`installs:${rq.params.pluginName}`);
    let val = parseInt(result);
    if (isNaN(val)) {
        val = 0;
    }
    val++;
    await redisSet(`installs:${rq.params.pluginName}`, val.toString());
    await updateDefaultPluginCache(rq.params.pluginName);
    rs.json(val);
});

/**
 * List all plugins (as {@type PluginInfo[]})
 */
app.get('/plugins', async (rq, rs) => {
    // update plugins data
    if (Date.now() - lastUpdateTime >= updateIntervalSec * 1000 || rq.query.refreshCache) {
        await updatePluginCache();
    }

    if (rq.query.proxy && rq.query.proxy == 'true') {
        rs.status(200).json(Array.from(proxyPlugins.values()));
    } else {
        rs.status(200).json(Array.from(plugins.values()));
    }

});

app.get('/ping', (rs, rq) => rq.send('pong'));

app.listen(port,() => console.log(`Listening on ${baseAddress}...`));
