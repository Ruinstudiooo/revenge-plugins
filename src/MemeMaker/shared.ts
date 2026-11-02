import { parseKeys } from './gemini'

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
	/** gemini api keys, one per line, used in order until one answers */
	keys: string
	/** gemini model name, blank means pick one the key actually has */
	model: string
}

export const DefaultSettings: Settings = {
	meme: true,
	memetext: true,
	random: true,
	ask: true,
	rewrite: true,
	shakespeare: true,
	keys: '',
	model: 'gemini-2.5-flash',
}

export function store(): Record<string, any> {
	return (vendetta.plugin.storage ??= {})
}

export function readSettings(): Settings {
	return { ...DefaultSettings, ...store() }
}

/** the raw key list, older installs kept a single key under apiKey */
export function readKeys(): string[] {
	const saved = store()
	return parseKeys(saved.keys ?? saved.apiKey ?? '')
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
