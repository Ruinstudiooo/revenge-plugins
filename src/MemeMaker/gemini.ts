const Base = 'https://generativelanguage.googleapis.com/v1beta/models'

// only used when the key cannot list its own models. names here can go stale,
// the list call is what actually keeps this working.
const StaticFallbacks = [
	'gemini-2.5-flash',
	'gemini-2.5-flash-lite',
	'gemini-2.0-flash',
	'gemini-2.0-flash-lite',
]

// model list per key, so a rotation does not pay for the lookup twice
const modelCache = new Map<string, string[]>()

// a model google says is out of quota stays out for a while. without this every
// command pays four dead round trips per key before reaching one that answers
const dry = new Map<string, { until: number; message: string }>()

function retryAfter(body: string): number {
	const fallback = 10 * 60 * 1000
	const ceiling = 6 * 3600 * 1000
	const floor = 5 * 1000

	try {
		const details = JSON.parse(body)?.error?.details ?? []
		for (const detail of details) {
			const raw = detail?.retryDelay
			if (typeof raw === 'string' && /^\d+(\.\d+)?s$/.test(raw)) {
				return Math.min(Math.max(parseFloat(raw) * 1000, floor), ceiling)
			}
		}
	} catch {
		// not json, fall through to the text
	}

	const match = /retry in ([0-9hms.]+)/i.exec(body)
	if (match) {
		let ms = 0
		const units = /([\d.]+)([hms])/g
		let part: RegExpExecArray | null
		while ((part = units.exec(match[1]))) {
			const n = parseFloat(part[1])
			if (!Number.isFinite(n)) continue
			ms += part[2] === 'h' ? n * 3600000 : part[2] === 'm' ? n * 60000 : n * 1000
		}
		if (ms > 0) return Math.min(Math.max(ms, floor), ceiling)
	}

	return fallback
}

function noteDry(key: string, model: string, body: string, message: string) {
	dry.set(`${key}:${model}`, { until: Date.now() + retryAfter(body), message })
}

function dryNote(key: string, model: string) {
	const entry = dry.get(`${key}:${model}`)
	if (!entry) return undefined
	if (entry.until <= Date.now()) {
		dry.delete(`${key}:${model}`)
		return undefined
	}
	return entry.message
}

// stays on the last key that answered, so a working key is not skipped
let preferred = 0

export interface GenerateOptions {
	keys: string[]
	model?: string
	temperature?: number
	maxTokens?: number
	timeout?: number
}

export function parseKeys(raw: string): string[] {
	return String(raw ?? '')
		.split(/[\s,]+/)
		.map(key => key.trim())
		.filter(Boolean)
		.filter((key, index, all) => all.indexOf(key) === index)
}

function shortName(name: string) {
	return String(name ?? '').replace(/^models\//, '')
}

function pickError(body: string) {
	try {
		return JSON.parse(body)?.error?.message ?? body
	} catch {
		return body
	}
}

async function request(url: string, init: RequestInit, timeout: number) {
	const abort = new AbortController()
	const timer = setTimeout(() => abort.abort(), timeout)

	try {
		return await fetch(url, { ...init, signal: abort.signal })
	} catch (error: any) {
		if (error?.name === 'AbortError') throw new Error('gemini took too long to answer')
		throw error
	} finally {
		clearTimeout(timer)
	}
}

/** everything this key can actually generate with */
async function availableModels(key: string, timeout: number): Promise<string[] | undefined> {
	const cached = modelCache.get(key)
	if (cached?.length) return cached

	try {
		const response = await request(`${Base}?key=${encodeURIComponent(key)}&pageSize=1000`, { method: 'GET' }, timeout)
		if (!response.ok) return undefined

		const data = JSON.parse(await response.text())
		const list: string[] = (data?.models ?? [])
			.filter((model: any) => {
				const methods = model?.supportedGenerationMethods ?? model?.supportedActions ?? []
				return Array.isArray(methods) && methods.includes('generateContent')
			})
			.map((model: any) => shortName(model?.name))
			.filter(Boolean)

		if (!list.length) return undefined
		modelCache.set(key, list)
		return list
	} catch {
		return undefined
	}
}

/**
 * the wanted name first when the key has it, then a flash model because they are
 * the cheap and fast ones, then whatever is left. this is what stops the 404 on
 * a model a key never had.
 */
function chooseModels(available: string[] | undefined, wanted?: string): string[] {
	const name = (wanted ?? '').trim()
	const list = available?.length ? available : StaticFallbacks
	const out: string[] = []

	const push = (model?: string) => {
		if (model && !out.includes(model)) out.push(model)
	}

	if (name && list.includes(name)) push(name)

	for (const model of list) {
		if (/flash/i.test(model) && !/thinking|exp|preview|learnlm/i.test(model)) push(model)
	}

	if (name && !out.includes(name)) push(name)
	for (const model of list) push(model)

	return out.length ? out : [name || StaticFallbacks[0]]
}

function supportsThinking(model: string) {
	return /2\.5/i.test(model)
}

type CallResult =
	| { text: string }
	| { retryModel: true; quota?: boolean; error?: Error }
	| { retryKey: true; quota?: boolean; error?: Error }

/** keep the status in the text, it is the only thing the user can act on */
function httpError(status: number, message: string) {
	return new Error(`gemini ${status}: ${message}`)
}

async function call(
	key: string,
	model: string,
	prompt: string,
	opts: GenerateOptions,
	thinking: boolean,
): Promise<CallResult> {
	const url = `${Base}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`
	const generationConfig: Record<string, any> = {
		temperature: opts.temperature ?? 0.7,
		maxOutputTokens: opts.maxTokens ?? 1024,
	}

	// 2.5 spends the token budget thinking before it writes, which can leave the
	// answer empty. asking for none of it keeps the reply in the message.
	if (thinking && supportsThinking(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 }

	let response: Response
	try {
		response = await request(
			url,
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					contents: [{ role: 'user', parts: [{ text: prompt }] }],
					generationConfig,
				}),
			},
			opts.timeout ?? 30000,
		)
	} catch (error: any) {
		return { retryKey: true, error: error instanceof Error ? error : new Error('gemini did not answer') }
	}

	const body = await response.text()

	if (!response.ok) {
		const message = pickError(body)

		// unknown model or a config this model does not take, worth another model
		if (response.status === 400 || response.status === 404) return { retryModel: true }

		// out of quota on this model. the key itself is fine, google hands the
		// quota out per model per project, so the next model often still answers.
		if (response.status === 429) {
			console.error(`[meme-maker] gemini 429 on ${model}`)
			noteDry(key, model, body, `gemini 429: ${message}`)
			return { retryModel: true, quota: true, error: httpError(429, message) }
		}

		// bad key, server trouble, worth another key
		console.error(`[meme-maker] gemini ${response.status}: ${message}`)
		if (response.status === 401 || response.status === 403 || response.status >= 500) {
			return { retryKey: true, error: httpError(response.status, message) }
		}

		throw new Error(`gemini ${response.status}: ${message}`)
	}

	const data = JSON.parse(body)
	const text = (data?.candidates?.[0]?.content?.parts ?? [])
		.map((part: any) => part?.text ?? '')
		.join('')
		.trim()

	if (!text) {
		const blocked = data?.promptFeedback?.blockReason ?? data?.candidates?.[0]?.finishReason
		throw new Error(blocked ? `gemini refused (${blocked})` : 'gemini sent an empty answer back')
	}

	return { text }
}

/** one prompt in, plain text out, across every key that was saved */
export async function generate(prompt: string, opts: GenerateOptions): Promise<string> {
	const keys = parseKeys(opts.keys.join(' '))
	if (!keys.length) throw new Error('no gemini api key saved yet, open the plugin settings and paste one')

	const timeout = opts.timeout ?? 30000
	let lastError: any
	let tried = 0
	// true while every single failure so far was google saying "out of quota"
	let allQuota = true

	for (let step = 0; step < keys.length; step++) {
		const index = (preferred + step) % keys.length
		const key = keys[index]
		const all = chooseModels(await availableModels(key, timeout), opts.model)

		tried++

		// skip what google already said is empty on this key. if nothing is
		// left, that key is done and the next one gets the turn right away
		const models = all.filter(model => !dryNote(key, model))
		if (!models.length) {
			lastError = new Error(dryNote(key, all[0]) ?? 'gemini is out of quota')
			continue
		}

		for (const model of models) {
			let result: CallResult

			try {
				result = await call(key, model, prompt, opts, true)
			} catch (error: any) {
				// refused or empty answer, one cooler attempt on the same model
				// clears a fair share of those before giving up on it
				lastError = error
				allQuota = false

				try {
					result = await call(key, model, prompt, { ...opts, temperature: 0.4 }, true)
				} catch (retry: any) {
					lastError = retry
					continue
				}
			}

			if ('text' in result) {
				preferred = index
				return result.text
			}

			allQuota = allQuota && Boolean(result.quota)

			// a 429 only empties one model's bucket, a 404 means the key never
			// had it. either way the next name in the list gets a turn before
			// the whole key is written off
			lastError =
				result.error ?? new Error(result.quota ? 'gemini is out of quota' : `gemini does not have ${model} on this key`)

			if ('retryKey' in result) break
		}
	}

	const detail = lastError?.message ?? 'no answer'
	const count = `${tried} key${tried === 1 ? '' : 's'}`
	const hint = allQuota
		? '\ngoogle gives the free tier out per project and model, so keys made under the same project share the same 20 a day. make the extra keys on another google account, or turn on billing for that project.'
		: ''

	throw new Error(`${detail} (tried ${count})${hint}`)
}

/** discord cuts a message at 2000, leave room for the rest of the line */
export function shorten(text: string, max = 1900) {
	const clean = text.trim()
	return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}
