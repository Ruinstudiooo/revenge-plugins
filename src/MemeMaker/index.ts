import SettingsScreen from './settings'
import { bindChange, readKeys, readSettings } from './shared'
import { customUrl, lastImageUrl, memeUrl, readOptions } from './meme'
import { randomTemplate } from './templates'
import { generate, shorten } from './gemini'

// ApplicationCommandOptionType.STRING. the enum is not exported to plugins.
const Str = 3

let disposers: (() => void)[] = []
let announced = false

function toast(message: string) {
	try {
		vendetta.ui.toasts.showToast(message)
	} catch {
		// toast api missing on some builds, console still has it
	}
	console.log(`[meme-maker] ${message}`)
}

/** something went wrong that the user should see, not just the log */
function fail(where: string, error: any) {
	const text = error?.message ?? String(error)
	console.error(`[meme-maker] ${where}`, error)
	toast(`meme maker ${where}: ${text}`.slice(0, 180))
}

function selectedChannel(): string | undefined {
	try {
		return vendetta.metro.findByProps?.('getChannelId', 'getLastSelectedChannelId')?.getChannelId?.() ?? undefined
	} catch {
		return undefined
	}
}

function channelOf(ctx: any): string | undefined {
	return selectedChannel() ?? ctx?.channel?.id ?? ctx?.channelId ?? ctx?.channel?.channelId
}

// per step toasts. off in the shipped build, flip it back on when a command
// stops posting and the failure needs to be visible on the device.
const DEBUG = false

function trace(message: string) {
	if (DEBUG) toast(message)
}

function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * the send calls resolve whether or not anything reaches the channel, so the
 * only honest check is looking for the message afterwards. undefined means
 * there is nothing to look at and the call is all we have to go on.
 */
async function landed(channelId: string, content: string): Promise<boolean | undefined> {
	try {
		const store = vendetta.metro.findByProps?.('getMessage', 'getMessages')
		if (!store?.getMessages) return undefined

		const raw = store.getMessages(channelId)
		if (!raw) return undefined

		const list = Array.isArray(raw) ? raw : (raw.toArray?.() ?? raw._array)
		if (!Array.isArray(list)) return undefined

		for (let i = list.length - 1; i >= 0 && i >= list.length - 8; i--) {
			if (list[i]?.content === content) return true
		}

		return false
	} catch {
		return undefined
	}
}

function channelLoaded(channelId: string): boolean | undefined {
	try {
		const store =
			vendetta.metro.findByProps?.('getChannel', 'getDMFromUserId') ??
			vendetta.metro.findByProps?.('getChannel')
		if (!store?.getChannel) return undefined
		return Boolean(store.getChannel(channelId))
	} catch {
		return undefined
	}
}

function copyToClipboard(text: string) {
	try {
		const clipboard =
			vendetta.metro.common?.clipboard ??
			vendetta.metro.findByProps?.('setString', 'getString', 'hasString')
		clipboard?.setString?.(text)
		return true
	} catch {
		return false
	}
}

/**
 * discord rejects a half filled message quietly, so send the same shape a real
 * send uses, wait, then look for the message before claiming anything went out.
 */
async function deliver(ctx: any, content: string) {
	const channelId = channelOf(ctx)

	if (!channelId) {
		trace('meme maker: no channel in the command context')
		return { content }
	}

	const known = channelLoaded(channelId)
	trace(`meme maker: channel ${known === undefined ? 'unknown' : known ? 'ok' : 'not loaded'}`)

	const payload = { content, tts: false, invalidEmojis: [], validNonShortcutEmojis: [] }

	const senders = [
		() => vendetta.metro.findByProps?.('sendMessage', 'editMessage')?.sendMessage,
		() => vendetta.metro.findByProps?.('sendMessage', 'receiveMessage')?.sendMessage,
	]

	for (const get of senders) {
		try {
			const send = get()
			if (typeof send !== 'function') continue

			await send(channelId, payload)
			await sleep(400)

			if ((await landed(channelId, content)) !== false) {
				trace('meme maker: posted')
				return undefined
			}
			console.error('[meme-maker] sendMessage resolved but nothing landed')
		} catch (error) {
			console.error('[meme-maker] sendMessage failed', error)
		}
	}

	// last resort, matches what the built in slash commands use
	try {
		const bot = vendetta.metro.findByProps?.('sendBotMessage')?.sendBotMessage
		if (typeof bot === 'function') {
			await bot(channelId, payload)
			await sleep(400)

			if ((await landed(channelId, content)) !== false) {
				trace('meme maker: posted as bot message')
				return undefined
			}
			console.error('[meme-maker] sendBotMessage resolved but nothing landed')
		}
	} catch (error) {
		console.error('[meme-maker] sendBotMessage failed', error)
	}

	// nothing reached the channel, at least hand over the link
	if (copyToClipboard(content)) {
		trace('meme maker: nothing landed, link copied instead')
	} else {
		trace('meme maker: could not post or copy')
	}

	// let revenge try too
	return { content }
}

/** a command that throws inside execute takes the whole message with it, so catch here */
async function guarded(name: string, ctx: any, run: () => string | Promise<string>) {
	trace(`meme maker: /${name} ran`)
	try {
		return await deliver(ctx, await run())
	} catch (error: any) {
		console.error('[meme-maker] execute failed', error)
		const text = `meme maker: ${error?.message ?? error}`
		try {
			return await deliver(ctx, text)
		} catch {
			return { content: text }
		}
	}
}

/** shared shell for the three gemini commands */
function aiCommand(config: {
	name: string
	description: string
	option: string
	optionDescription: string
	build: (text: string) => string
	temperature?: number
}) {
	return {
		name: config.name,
		displayName: config.name,
		description: config.description,
		displayDescription: config.description,
		applicationId: '-1',
		type: 1,
		inputType: 1,
		options: [
			{
				name: config.option,
				displayName: config.option,
				description: config.optionDescription,
				displayDescription: config.optionDescription,
				type: Str,
				required: true,
			},
		],
		execute(args: any[], ctx: any) {
			return guarded(config.name, ctx, async () => {
				const opts = readOptions(args)
				const text = (opts[config.option] ?? '').trim()
				if (!text) return `type something after /${config.name}`

				const settings = readSettings()
				const keys = readKeys()
				toast(keys.length > 1 ? `meme maker: asking gemini (${keys.length} keys)` : 'meme maker: asking gemini')

				const answer = await generate(config.build(text), {
					keys,
					model: settings.model,
					temperature: config.temperature,
				})

				return shorten(answer)
			})
		},
	}
}

function randomCommand() {
	return {
		name: 'random',
		displayName: 'random',
		description: 'post a random meme, with your text if you give any',
		displayDescription: 'post a random meme, with your text if you give any',
		applicationId: '-1',
		type: 1,
		inputType: 1,
		options: [
			{ name: 'top', displayName: 'top', description: 'top line', displayDescription: 'top line', type: Str, required: false },
			{
				name: 'bottom',
				displayName: 'bottom',
				description: 'bottom line',
				displayDescription: 'bottom line',
				type: Str,
				required: false,
			},
		],
		execute(args: any[], ctx: any) {
			return guarded('random', ctx, () => {
				const opts = readOptions(args)
				return memeUrl(randomTemplate(), opts.top ?? '', opts.bottom ?? '')
			})
		},
	}
}

function memeCommand() {
	return {
		name: 'meme',
		displayName: 'meme',
		description: 'make a meme',
		displayDescription: 'make a meme',
		applicationId: '-1',
		type: 1,
		inputType: 1,
		options: [
			{
				name: 'template',
				displayName: 'template',
				description: 'template id like drake or stonks, blank picks a random one',
				displayDescription: 'template id like drake or stonks, blank picks a random one',
				type: Str,
				required: false,
			},
			{ name: 'top', displayName: 'top', description: 'top line', displayDescription: 'top line', type: Str, required: false },
			{
				name: 'bottom',
				displayName: 'bottom',
				description: 'bottom line',
				displayDescription: 'bottom line',
				type: Str,
				required: false,
			},
		],
		execute(args: any[], ctx: any) {
			return guarded('meme', ctx, () => {
				const opts = readOptions(args)
				return memeUrl(opts.template ?? '', opts.top ?? '', opts.bottom ?? '')
			})
		},
	}
}

function memeTextCommand() {
	return {
		name: 'memetext',
		displayName: 'memetext',
		description: 'put text on the last image posted in this channel',
		displayDescription: 'put text on the last image posted in this channel',
		applicationId: '-1',
		type: 1,
		inputType: 1,
		options: [
			{
				name: 'text',
				displayName: 'text',
				description: 'what the picture should say',
				displayDescription: 'what the picture should say',
				type: Str,
				required: true,
			},
			{ name: 'top', displayName: 'top', description: 'separate line above it', displayDescription: 'separate line above it', type: Str, required: false },
			{
				name: 'image',
				displayName: 'image',
				description: 'image url, if not the last one in the channel',
				displayDescription: 'image url, if not the last one in the channel',
				type: Str,
				required: false,
			},
		],
		execute(args: any[], ctx: any) {
			return guarded('memetext', ctx, () => {
				const opts = readOptions(args)
				const text = (opts.text ?? '').trim()
				if (!text) return 'give me something to write first'

				const background = opts.image?.trim() || lastImageUrl(channelOf(ctx))
				if (!background) {
					return 'no image in this channel yet. post one, or pass image: with a link.'
				}

				return customUrl(background, opts.top ?? '', text)
			})
		},
	}
}

function askCommand() {
	return aiCommand({
		name: 'ask',
		description: 'ask gemini anything',
		option: 'question',
		optionDescription: 'what you want to know',
		build: text =>
			`You are answering a question inside a discord chat. Be direct, useful and as short as the question allows. Do not repeat the question back.\n\n${text}`,
		temperature: 0.6,
	})
}

function rewriteCommand() {
	return aiCommand({
		name: 'r',
		description: 'rewrite your sentence with correct grammar and better words',
		option: 'text',
		optionDescription: 'the sentence to fix',
		build: text =>
			`Rewrite the text below with correct grammar, natural phrasing and better word choice. Keep the meaning, the tone and the language it is written in. Reply with the rewritten text only, no quotes, no explanation, no notes.\n\n${text}`,
		temperature: 0.4,
	})
}

function shakespeareCommand() {
	return aiCommand({
		name: 'shakespeare',
		description: 'rewrite your sentence like shakespeare',
		option: 'text',
		optionDescription: 'the sentence to rewrite',
		build: text =>
			`Rewrite the text below in the voice of William Shakespeare: early modern english, thee and thou, inverted phrasing, a little dramatic flourish. Keep the meaning. Reply with the rewritten text only, no quotes, no explanation, no notes.\n\n${text}`,
		temperature: 0.8,
	})
}

function register(command: any) {
	try {
		const dispose = vendetta.commands.registerCommand(command)
		disposers.push(typeof dispose === 'function' ? dispose : () => {})

		// discord numbers its built in commands downwards from -1, so -60 is a
		// normal id. only NaN means revenge could not work a number out at all
		if (Number.isNaN(Number(command.id))) {
			trace(`meme maker: /${command.name} got a bad id (${command.id})`)
		}

		return true
	} catch (error) {
		fail(`could not add /${command.name}`, error)
		return false
	}
}

/**
 * registering twice would duplicate the entry in the picker, so every sync
 * unregisters what the last one added. toggles in the settings screen land here.
 */
function sync() {
	for (const dispose of disposers) {
		try {
			dispose()
		} catch {
			// already gone, fine
		}
	}
	disposers = []

	const settings = readSettings()

	if (typeof vendetta?.commands?.registerCommand !== 'function') {
		toast('meme maker: this revenge build has no slash command api')
		return
	}

	const wanted: string[] = []
	if (settings.meme && register(memeCommand())) wanted.push('/meme')
	if (settings.memetext && register(memeTextCommand())) wanted.push('/memetext')
	if (settings.random && register(randomCommand())) wanted.push('/random')
	if (settings.ask && register(askCommand())) wanted.push('/ask')
	if (settings.rewrite && register(rewriteCommand())) wanted.push('/r')
	if (settings.shakespeare && register(shakespeareCommand())) wanted.push('/shakespeare')

	// one line on start so its obvious whether the plugin actually loaded
	if (!announced && wanted.length) {
		announced = true
		trace(`meme maker ready: ${wanted.join(' ')}`)
	}
}

export default {
	onLoad() {
		try {
			bindChange(sync)
			sync()
		} catch (error) {
			fail('failed to load', error)
		}
	},
	onUnload() {
		for (const dispose of disposers) {
			try {
				dispose()
			} catch {
				// same
			}
		}
		disposers = []
		bindChange(() => {})
	},
	settings: SettingsScreen,
}
