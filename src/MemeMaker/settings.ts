import { readSettings, writeSettings } from './shared'
import type { Settings } from './shared'
import { DefaultModel } from './groq'

type Toggle = 'meme' | 'memetext' | 'random' | 'ask' | 'rewrite' | 'shakespeare'

export default function SettingsScreen() {
	const React = vendetta.metro.common.React
	const RN = vendetta.metro.common.ReactNative
	const [state, setState] = React.useState(() => readSettings() as Settings)
	const [key, setKey] = React.useState(String(state.key ?? ''))
	const [model, setModel] = React.useState(String(state.model ?? ''))
	const [savedAt, setSavedAt] = React.useState(0)
	const keyTimer = React.useRef(null)
	const modelTimer = React.useRef(null)
	// what is actually in the boxes right now, so a press or a blur never writes
	// an older value back over a fresh paste
	const latestKey = React.useRef(String(state.key ?? ''))
	const latestModel = React.useRef(String(state.model ?? ''))

	const toggle = (name: Toggle) => {
		const next = !state[name]
		writeSettings({ [name]: next } as Partial<Settings>)
		setState({ ...state, [name]: next })
	}

	const onChangeKey = (text: string) => {
		latestKey.current = text
		setKey(text)
		if (keyTimer.current) clearTimeout(keyTimer.current)
		keyTimer.current = setTimeout(() => {
			writeSettings({ key: latestKey.current.trim() })
			setSavedAt(Date.now())
		}, 600)
	}

	const onChangeModel = (text: string) => {
		latestModel.current = text
		setModel(text)
		if (modelTimer.current) clearTimeout(modelTimer.current)
		modelTimer.current = setTimeout(() => {
			writeSettings({ model: latestModel.current.trim() })
			setSavedAt(Date.now())
		}, 600)
	}

	const save = () => {
		if (keyTimer.current) clearTimeout(keyTimer.current)
		if (modelTimer.current) clearTimeout(modelTimer.current)

		const cleanKey = latestKey.current.trim()
		const cleanModel = latestModel.current.trim()

		latestKey.current = cleanKey
		latestModel.current = cleanModel
		setKey(cleanKey)
		setModel(cleanModel)
		writeSettings({ key: cleanKey, model: cleanModel })
		setState({ ...state, key: cleanKey, model: cleanModel })
		setSavedAt(Date.now())
	}

	const row = (name: Toggle, label: string, sub: string) =>
		React.createElement(
			RN.View,
			{ key: name, style: styles.row },
			React.createElement(
				RN.View,
				{ style: styles.texts },
				React.createElement(RN.Text, { style: styles.label }, label),
				React.createElement(RN.Text, { style: styles.sub }, sub),
			),
			React.createElement(RN.Switch, { value: Boolean(state[name]), onValueChange: () => toggle(name) }),
		)

	const field = (config: {
		label: string
		value: string
		placeholder: string
		onChange: (text: string) => void
		onBlur: () => void
		hint?: string
	}) =>
		React.createElement(
			RN.View,
			{ key: config.label, style: styles.field },
			React.createElement(RN.Text, { style: styles.label }, config.label),
			React.createElement(RN.TextInput, {
				style: styles.input,
				value: config.value,
				placeholder: config.placeholder,
				placeholderTextColor: '#6b6f76',
				autoCapitalize: 'none',
				autoCorrect: false,
				secureTextEntry: config.label === 'api key',
				onChangeText: config.onChange,
				onBlur: config.onBlur,
				onSubmitEditing: config.onBlur,
			}),
			config.hint ? React.createElement(RN.Text, { style: styles.hint }, config.hint) : null,
		)

	const looksRight = key.trim().startsWith('gsk_')

	return React.createElement(
		RN.ScrollView,
		{ style: styles.screen, contentContainerStyle: styles.content },
		React.createElement(RN.Text, { style: styles.section }, 'commands'),
		row('meme', '/meme', 'any template, top and bottom text, or a random one'),
		row('memetext', '/memetext', 'writes on the last picture posted in the channel'),
		row('random', '/random', 'posts a random meme'),
		row('ask', '/ask', 'asks groq a question'),
		row('rewrite', '/r', 'fixes grammar and wording'),
		row('shakespeare', '/shakespeare', 'rewrites your line like shakespeare'),

		React.createElement(RN.Text, { style: styles.section }, 'groq'),
		field({
			label: 'api key',
			value: key,
			placeholder: 'gsk_...',
			onChange: onChangeKey,
			onBlur: save,
			hint: key.trim()
				? looksRight
					? 'looks like a groq key. one key, one request, no queue'
					: 'groq keys start with gsk_, this one does not'
				: 'paste your key, it saves as you type',
		}),
		field({
			label: 'model',
			value: model,
			placeholder: DefaultModel,
			onChange: onChangeModel,
			onBlur: save,
			hint: `blank uses ${DefaultModel}`,
		}),
		React.createElement(
			RN.Pressable,
			{ onPress: save, style: styles.button },
			React.createElement(RN.Text, { style: styles.buttonText }, 'save'),
		),
		savedAt ? React.createElement(RN.Text, { style: styles.hint }, 'saved, go run a command') : null,
		React.createElement(
			RN.Text,
			{ style: styles.note },
			'free key from console.groq.com/keys. it stays in this plugin storage on your phone and only goes to groq.',
		),
		React.createElement(
			RN.Text,
			{ style: styles.note },
			'no key rotation any more. one key, one call, so a command answers in a second or two instead of trying every model and key in turn.',
		),
		React.createElement(
			RN.Text,
			{ style: styles.note },
			'images come from memegen.link, so the meme commands need internet. turning one off removes it from the slash picker right away.',
		),
	)
}

const styles = {
	screen: { flex: 1 },
	content: { padding: 16, gap: 4, paddingBottom: 40 },
	section: {
		color: '#7f8489',
		fontSize: 12,
		fontWeight: '600',
		textTransform: 'uppercase',
		marginTop: 16,
		marginBottom: 4,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
		paddingVertical: 12,
	},
	texts: { flex: 1, gap: 2 },
	label: { color: '#f2f3f5', fontSize: 16, fontWeight: '500' },
	sub: { color: '#a3a6aa', fontSize: 13 },
	field: { gap: 6, paddingVertical: 10 },
	input: {
		backgroundColor: '#2b2d31',
		color: '#f2f3f5',
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 10,
		fontSize: 15,
	},
	button: {
		alignSelf: 'flex-start',
		backgroundColor: '#5865f2',
		borderRadius: 8,
		paddingHorizontal: 14,
		paddingVertical: 9,
		marginTop: 2,
		marginBottom: 6,
	},
	buttonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
	hint: { color: '#7f8489', fontSize: 12, lineHeight: 16 },
	note: { color: '#7f8489', fontSize: 12, marginTop: 10, lineHeight: 17 },
} as const
