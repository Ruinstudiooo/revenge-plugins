const Endpoint = 'https://api.groq.com/openai/v1/chat/completions'

/** fast and good enough for a rewrite or a short answer */
export const DefaultModel = 'llama-3.3-70b-versatile'

/** groq retires models now and then, this is only asked when the pinned one is gone */
const BackupModel = 'llama-3.1-8b-instant'

export interface GenerateOptions {
	key: string
	model?: string
	temperature?: number
	maxTokens?: number
	timeout?: number
}

class GroqError extends Error {
	status: number

	constructor(status: number, message: string) {
		super(message)
		this.status = status
	}
}

function pickError(body: string) {
	try {
		return JSON.parse(body)?.error?.message ?? body
	} catch {
		return body
	}
}

function missingModel(error: any) {
	const message = String(error?.message ?? '')
	return error?.status === 404 || /model[^.]*(decommission|not found|does not exist|no longer)/i.test(message)
}

async function call(model: string, prompt: string, opts: GenerateOptions): Promise<string> {
	const abort = new AbortController()
	const timer = setTimeout(() => abort.abort(), opts.timeout ?? 20000)

	let response: Response
	try {
		response = await fetch(Endpoint, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${opts.key.trim()}`,
			},
			body: JSON.stringify({
				model,
				messages: [{ role: 'user', content: prompt }],
				temperature: opts.temperature ?? 0.7,
				max_tokens: opts.maxTokens ?? 1024,
				stream: false,
			}),
			signal: abort.signal,
		})
	} catch (error: any) {
		if (error?.name === 'AbortError') throw new Error('groq took too long, try once more')
		throw new Error('groq is not reachable, check the connection')
	} finally {
		clearTimeout(timer)
	}

	const body = await response.text()

	if (!response.ok) {
		const message = pickError(body)
		if (response.status === 401 || response.status === 403) {
			throw new GroqError(response.status, 'groq rejected the key, paste a fresh one in the plugin settings')
		}
		if (response.status === 429) {
			throw new GroqError(response.status, `groq is rate limiting right now, give it a moment. ${message}`)
		}
		throw new GroqError(response.status, `groq ${response.status}: ${message}`)
	}

	const data = JSON.parse(body)
	const text = String(data?.choices?.[0]?.message?.content ?? '').trim()
	if (!text) throw new Error('groq sent an empty answer back')
	return text
}

/** one prompt in, plain text out. one key, one request, no queue behind it */
export async function generate(prompt: string, opts: GenerateOptions): Promise<string> {
	const key = String(opts.key ?? '').trim()
	if (!key) throw new Error('no groq api key saved yet, open the plugin settings and paste one')

	const model = opts.model?.trim() || DefaultModel

	try {
		return await call(model, prompt, opts)
	} catch (error: any) {
		// a retired model is the only thing worth a second request. a rate limit
		// or a blocked answer will just repeat itself and make the wait worse
		if (!missingModel(error)) throw error
		if (model === BackupModel) throw error
		return call(BackupModel, prompt, opts)
	}
}

/** discord cuts a message at 2000, leave room for the rest of the line */
export function shorten(text: string, max = 1900) {
	const clean = text.trim()
	return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}
