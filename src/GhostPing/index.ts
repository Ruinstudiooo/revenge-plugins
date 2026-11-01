import SettingsScreen from './settings'
import { readSettings } from './shared'

interface Author {
	id: string
	username?: string
	globalName?: string
	bot?: boolean
}

interface MessageRecord {
	id: string
	content?: string
	author?: Author
	mentions?: { id: string }[]
	mention_everyone?: boolean
	timestamp?: string
}

interface DeletePayload {
	id: string
	channelId: string
}

// every message we see gets kept for a bit. the delete event only carries an id,
// so this is where the text comes from when someone removes a ping.
const recent = new Map<string, MessageRecord>()
const MaxRecent = 200

let dispose: (() => void) | undefined
let myId: string | undefined
let askedForId = false

function whoAmI() {
	if (askedForId) return myId
	askedForId = true

	try {
		myId = vendetta.metro.findByStoreName('UserStore')?.getCurrentUser()?.id
	} catch {
		myId = undefined
	}

	return myId
}

function remember(message: MessageRecord) {
	if (!message?.id) return

	recent.set(message.id, message)
	if (recent.size <= MaxRecent) return

	const oldest = recent.keys().next().value
	if (oldest) recent.delete(oldest)
}

function pingedUs(record: MessageRecord, everyone: boolean, id?: string) {
	if (id && record.mentions?.some(user => user.id === id)) return true
	return everyone && record.mention_everyone === true
}

function tooOld(record: MessageRecord, maxAge: number) {
	if (!maxAge || !record.timestamp) return false

	const sent = Date.parse(record.timestamp)
	if (!Number.isFinite(sent)) return false

	return Date.now() - sent > maxAge * 60_000
}

function preview(record: MessageRecord) {
	const text = (record.content ?? '').replace(/\s+/g, ' ').trim()
	if (!text) return 'attachment only'
	return text.length > 70 ? `${text.slice(0, 70)}...` : text
}

function nameOf(record: MessageRecord) {
	return record.author?.globalName ?? record.author?.username ?? 'someone'
}

function toast(text: string) {
	try {
		vendetta.ui.toasts.showToast(text)
	} catch {
		console.log(`[ghost-ping] ${text}`)
	}
}

function onDelete(payload: DeletePayload) {
	const settings = readSettings()
	if (!settings.enabled || !payload?.id) return

	const record = recent.get(payload.id)
	recent.delete(payload.id)
	if (!record) return

	const id = whoAmI()
	if (id && record.author?.id === id) return
	if (settings.ignoreBots && record.author?.bot) return
	if (tooOld(record, settings.maxAge)) return
	if (!pingedUs(record, settings.everyone, id)) return

	toast(`ghost ping from ${nameOf(record)}: ${preview(record)}`)
}

export default {
	onLoad() {
		const Flux = vendetta.metro.common.FluxDispatcher

		dispose = vendetta.patcher.before('dispatch', Flux, (args: any[]) => {
			const payload = args[0]

			try {
				if (payload?.type === 'MESSAGE_CREATE' && payload.message) {
					remember(payload.message)
				} else if (payload?.type === 'MESSAGE_DELETE') {
					onDelete(payload)
				}
			} catch (error) {
				console.log('[ghost-ping] dispatch blew up', error)
			}
		})
	},
	onUnload() {
		dispose?.()
		dispose = undefined
		recent.clear()
	},
	settings: SettingsScreen,
}
