export interface Settings {
	/** the /meme command */
	meme: boolean
	/** the /memetext command */
	memetext: boolean
	/** the /random command */
	random: boolean
	/** the /ask command */
	ask: boolean
	/** the /r rewrite command */
	rewrite: boolean
	/** the /shakespeare command */
	shakespeare: boolean
	/** gemini api key, needed by ask, r and shakespeare */
	apiKey: string
	/** gemini model name, blank means the default */
	model: string
}

export const DefaultSettings: Settings = {
	meme: true,
	memetext: true,
	random: true,
	ask: true,
	rewrite: true,
	shakespeare: true,
	apiKey: '',
	model: 'gemini-2.5-flash',
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
