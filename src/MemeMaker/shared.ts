export interface Settings {
	/** the /meme command */
	meme: boolean
	/** the /memetext command */
	memetext: boolean
}

export const DefaultSettings: Settings = {
	meme: true,
	memetext: true,
}

export function store(): Record<string, any> {
	return (vendetta.plugin.storage ??= {})
}

export function readSettings(): Settings {
	return { ...DefaultSettings, ...store() }
}

export function writeSettings(patch: Partial<Settings>) {
	Object.assign(store(), patch)
	notifyChange()
}

let changed: (() => void) | undefined

/** the entry file hands us its re-register function here */
export function bindChange(fn: () => void) {
	changed = fn
}

function notifyChange() {
	try {
		changed?.()
	} catch {
		// settings screen should not blow up because a command failed
	}
}
