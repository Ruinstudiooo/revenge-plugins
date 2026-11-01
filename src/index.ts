import SettingsComponent from './settings'
import { bindStorage, readSettings } from './shared'
import type { Settings } from './shared'

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
	guildId?: string
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
		myId = bunny.metro.findByStoreName('UserStore')?.getCurrentUser()?.id
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

function pingedUs(record: MessageRecord, settings: Settings, id?: string) {
	if (id && record.mentions?.some(user => user.id === id)) return true
	if (settings.everyone && record.mention_everyone) return true
	return false
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
		bunny.ui.toasts.showToast(text)
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
	if (!pingedUs(record, settings, id)) return

	toast(`ghost ping from ${nameOf(record)}: ${preview(record)}`)
}

export default definePlugin({
	start() {
		bindStorage(bunny.plugin.createStorage())

		dispose = bunny.api.flux.intercept((payload: Record<string, any>) => {
			if (payload?.type === 'MESSAGE_CREATE' && payload.message) {
				remember(payload.message)
			} else if (payload?.type === 'MESSAGE_DELETE') {
				onDelete(payload as unknown as DeletePayload)
			}
		})
	},
	stop() {
		dispose?.()
		dispose = undefined
		recent.clear()
	},
	SettingsComponent,
})
