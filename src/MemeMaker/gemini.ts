const Base = 'https://generativelanguage.googleapis.com/v1beta/models'

// only used when the key cannot list its own models. names here can go stale,
// the list call is what actually keeps this working.
const StaticFallbacks = ['gemini-2.5-flash', 'gemini-2.0-flash']

// model list per key, so a rotation does not pay for the lookup twice
const modelCache = new Map<string, string[]>()

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

async function call(
	key: string,
	model: string,
	prompt: string,
	opts: GenerateOptions,
	thinking: boolean,
): Promise<{ text: string } | { retryModel: true } | { retryKey: true; error?: Error }> {
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
		return { retryKey: true }
	}

	const body = await response.text()

	if (!response.ok) {
		const message = pickError(body)

		// unknown model or a config this model does not take, worth another model
		if (response.status === 400 || response.status === 404) return { retryModel: true }

		// bad key, no quota left, server trouble, worth another key
		console.error(`[meme-maker] gemini ${response.status}: ${message}`)
		if (response.status === 429 || response.status === 401 || response.status === 403 || response.status >= 500) {
			return { retryKey: true, error: new Error(`gemini ${response.status}: ${message}`) }
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

	for (let step = 0; step < keys.length; step++) {
		const index = (preferred + step) % keys.length
		const key = keys[index]
		const models = chooseModels(await availableModels(key, timeout), opts.model)

		let keyFailed = false
		tried++

		for (const model of models) {
			try {
				const result = await call(key, model, prompt, opts, true)

				if ('text' in result) {
					preferred = index
					return result.text
				}

				if ('retryKey' in result) {
					if (result.error) lastError = result.error
					keyFailed = true
					break
				}

				// model was not there for this key, next name in the list
				lastError = new Error(`gemini does not have ${model} on this key`)
				continue
			} catch (error: any) {
				lastError = error
				// pretend nothing happened and try one more, some answers come
				// back blocked for reasons a second attempt clears
				try {
					const second = await call(key, model, prompt, { ...opts, temperature: 0.5 }, true)
					if ('text' in second) {
						preferred = index
						return second.text
					}
				} catch (retry: any) {
					lastError = retry
				}
				break
			}
		}

		if (keyFailed) continue
	}

	const detail = lastError?.message ?? 'no answer'
	throw new Error(`${detail} (tried ${tried} key${tried === 1 ? '' : 's'})`)
}

/** discord cuts a message at 2000, leave room for the rest of the line */
export function shorten(text: string, max = 1900) {
	const clean = text.trim()
	return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}
