HunterPie Plugin registry
---

Implementation for plugin server that provides access to curated plugins list and allows to download them directly.

Key features:
- registry of plugins that doesn't require updates when plugin updates
- download counting
- ability to proxy download of registered plugins through server

How to add a new plugin to registry?
---

Create PR to this repository with `registry.json` containing your plugin data. More info in **Configuration** section below.


Configuration
---
Each registered plugin should be described in committed `registry.json` file. It is an array of `RegistryEntry` objects:
```ts
interface RegistryEntry {
    // internal name (should be unique)
    InternalName: string,
  
    // path to module.json
    Module: string

    // path to plugin image
    ImageUrl?: string,
    
    // path to readme file
    Readme?: string,
  
    // release date. Please use ISO 8601 format.
    // This is optional and will be overriden by ReleaseDate of plugin's module.json.
    ReleaseDate?: string    
}
```

**Environment variables:**
- PORT - port where application is hosted. Heroku will provide it automatically
- HEROKU_APP_NAME - heroku name of the application. Used to create correct proxy links. This will be provided by Heroku if https://devcenter.heroku.com/articles/dyno-metadata is enabled
- REDISCLOUD_URL - connection string for redis DB
- UPDATE_INTERVAL_SEC - how often to invalidate plugin cache
- APP_URL - full app url. Used after transition from heroku
- USE_MONGO - if 'true', mongo will be used isntead of redis to track installs count
- MONGO_CONNECTION_STRING - connection string to MongoDB
- IMPORT_KEY - defines secret key that is used as a password to import data from redis to mongo

Endpoints
---

- GET `/ping` - returns `pong` :)
- POST `/plugin/:pluginName/install` - notify server that plugin was installed and install counter should be incremented
- GET `/plugins` returns array of metadata for all registered plugins
    - query parameter `refreshCache` will force cache refresh
    - query parameter `proxy` will by using proxy metadata
- GET `/plugin/:pluginName/module/<path>` will return file by `<path>` based from root of configured `module.json` path
- GET `/plugin/:pluginName/readme/<path>` will return file by `<path>` based from root of configured readme path
- GET `/admin/redisImport?key=<IMPORT_KEY>&name=<name of import>` triggers import download count from redis to mongo

Plugin object model:
```ts
interface PluginInfo  {    
    DisplayName: string,
    Description: string,
    Author: string,
    Version: string
    MinVersion: string;
    Downloads: number;
    
    // derived from RegistryEntry:
    InternalName: string,
    ImageUrl?: string,
    Readme?: string,
    Module: string
}

```
