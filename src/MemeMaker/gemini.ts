const Base = 'https://generativelanguage.googleapis.com/v1beta/models'

// newest first. a key generated today can use the first one, older accounts
// sometimes only have the later ones, so try down the list on a 404.
const Fallbacks = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']

export interface GenerateOptions {
	key: string
	model?: string
	temperature?: number
	maxTokens?: number
	timeout?: number
}

function pickError(body: string) {
	try {
		const data = JSON.parse(body)
		return data?.error?.message ?? body
	} catch {
		return body
	}
}

function models(wanted?: string) {
	const list = [wanted?.trim() || '', ...Fallbacks].filter(Boolean)
	return list.filter((model, index) => list.indexOf(model) === index)
}

/** one prompt in, plain text out, model fallback and errors included */
export async function generate(prompt: string, opts: GenerateOptions): Promise<string> {
	const key = opts.key?.trim()
	if (!key) throw new Error('no gemini api key saved yet, open the plugin settings and paste one')

	let lastError: any

	for (const model of models(opts.model)) {
		const url = `${Base}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`
		let timer: any

		try {
			const abort = new AbortController()
			timer = setTimeout(() => abort.abort(), opts.timeout ?? 30000)

			const response = await fetch(url, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					contents: [{ role: 'user', parts: [{ text: prompt }] }],
					generationConfig: {
						temperature: opts.temperature ?? 0.7,
						maxOutputTokens: opts.maxTokens ?? 1024,
					},
				}),
				signal: abort.signal,
			})

			const body = await response.text()

			if (!response.ok) {
				lastError = new Error(`gemini ${response.status}: ${pickError(body)}`)

				// model not on this key, try the next one down
				if (response.status === 404) continue
				throw lastError
			}

			const data = JSON.parse(body)
			const text = (data?.candidates?.[0]?.content?.parts ?? [])
				.map((part: any) => part?.text ?? '')
				.join('')
				.trim()

			if (!text) throw new Error('gemini sent an empty answer back')
			return text
		} catch (error: any) {
			lastError = error
			if (error?.name === 'AbortError') {
				throw new Error('gemini took too long to answer')
			}
		} finally {
			if (timer) clearTimeout(timer)
		}
	}

	throw lastError ?? new Error('gemini did not answer')
}

/** discord cuts a message at 2000, leave room for the rest of the line */
export function shorten(text: string, max = 1900) {
	const clean = text.trim()
	return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}
