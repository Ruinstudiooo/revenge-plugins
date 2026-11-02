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
	/** groq api key, needed by ask, r and shakespeare */
	key: string
	/** groq model name, blank means the default one */
	model: string
}

export const DefaultSettings: Settings = {
	meme: true,
	memetext: true,
	random: true,
	ask: true,
	rewrite: true,
	shakespeare: true,
	key: '',
	model: '',
}

export function store(): Record<string, any> {
	return (vendetta.plugin.storage ??= {})
}

export function readSettings(): Settings {
	return { ...DefaultSettings, ...store() }
}

/**
 * the saved key. older builds kept gemini keys in `keys` and `apiKey`, those are
 * left alone, only something shaped like a groq key is picked up from them
 */
export function readKey(): string {
	const saved = store()
	const direct = String(saved.key ?? '').trim()
	if (direct) return direct

	for (const raw of [saved.keys, saved.apiKey]) {
		const found = String(raw ?? '')
			.split(/\s+/)
			.find(part => part.startsWith('gsk_'))
		if (found) return found
	}

	return ''
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
