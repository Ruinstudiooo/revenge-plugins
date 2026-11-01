export interface Settings {
	enabled: boolean
	/** also shout when the deleted message mentioned @everyone or @here */
	everyone: boolean
	/** skip deletes of messages older than this, in minutes. 0 keeps every one */
	maxAge: number
	ignoreBots: boolean
}

export const DefaultSettings: Settings = {
	enabled: true,
	everyone: true,
	maxAge: 15,
	ignoreBots: true,
}

/** set once the plugin starts, points at the json file revenge keeps for us */
export let storage: Partial<Settings> | undefined

export function bindStorage(next: Partial<Settings>) {
	storage = next
}

export function readSettings(): Settings {
	return { ...DefaultSettings, ...(storage ?? {}) }
}

export function writeSettings(patch: Partial<Settings>) {
	if (!storage) return
	for (const key in patch) {
		(storage as Record<string, unknown>)[key] = (patch as Record<string, unknown>)[key]
	}
}
