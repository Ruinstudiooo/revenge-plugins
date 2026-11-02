import { cleanTemplate, randomTemplate } from './templates'

const Base = 'https://api.memegen.link/images'

/**
 * memegen wants /template/top/bottom.png, blank lines are a bare underscore.
 * if only the bottom line is set we still need the empty top slot, otherwise
 * the text lands on line one instead of line two.
 */
export function memeUrl(template: string, top: string, bottom: string) {
	const name = cleanTemplate(template) || randomTemplate()
	const segments: string[] = []

	if (top) segments.push(encode(top))
	else if (bottom) segments.push('_')

	if (bottom) segments.push(encode(bottom))

	const path = segments.length ? `/${segments.join('/')}` : ''
	return `${Base}/${name}${path}.png?width=600&font=impact`
}

/** same renderer, but the picture is one we already have a url for */
export function customUrl(background: string, top: string, bottom: string) {
	const query = `background=${encodeURIComponent(background)}&width=600&font=impact`
	return `${Base}/custom/${top ? encode(top) : '_'}/${bottom ? encode(bottom) : '_'}.png?${query}`
}

function encode(text: string) {
	return encodeURIComponent(text.trim())
}

export function looksLikeImage(type?: string, url?: string) {
	if (type?.startsWith('image/')) return true
	if (!url) return false
	return /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i.test(url)
}

/**
 * metro moved this store around between discord versions, so try the names in
 * order instead of trusting one. a miss just means we fall through to the next.
 */
function messageStore(): any {
	const metro = vendetta?.metro
	if (!metro) return undefined

	const probes = [
		() => metro.findByStoreName?.('MessageStore'),
		() => metro.findByName?.('MessageStore'),
		() => metro.findByProps?.('getMessages', 'getMessage'),
	]

	for (const probe of probes) {
		try {
			const store = probe()
			if (store?.getMessages) return store
		} catch {
			// that lookup is not on this build
		}
	}

	return undefined
}

function toList(messages: any): any[] {
	if (!messages) return []
	if (Array.isArray(messages)) return messages
	if (typeof messages.toArray === 'function') return messages.toArray()
	if (Array.isArray(messages._array)) return messages._array
	return []
}

/**
 * slash commands run client side, so the message store already has everything
 * the channel has loaded. no rest call, no token juggling.
 */
export function lastImageUrl(channelId?: string): string | undefined {
	if (!channelId) return undefined

	try {
		const list = toList(messageStore()?.getMessages(channelId))

		for (let i = list.length - 1; i >= 0; i--) {
			const message = list[i]

			for (const file of message?.attachments ?? []) {
				const url = file?.url ?? file?.proxy_url
				if (looksLikeImage(file?.content_type, url)) return url
			}

			for (const embed of message?.embeds ?? []) {
				const url = embed?.image?.url ?? embed?.thumbnail?.url
				if (url) return url
			}
		}
	} catch {
		// store shape changes between builds, a miss just means no image
	}

	return undefined
}

/** options come in as a flat list, but walk nested ones anyway */
export function readOptions(args: any[]): Record<string, string> {
	const out: Record<string, string> = {}

	const walk = (list: any[]) => {
		for (const arg of list ?? []) {
			if (arg?.name && typeof arg.value === 'string') out[arg.name] = arg.value
			if (arg?.options) walk(arg.options)
		}
	}

	walk(args)
	return out
}
