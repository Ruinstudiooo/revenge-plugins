// classic revenge hands the plugin a `bunny` object and a `definePlugin` helper.
// everything below is typed loosely on purpose, the host shapes change between builds.
declare const bunny: any
declare function definePlugin<T>(plugin: T): T
