import { readSettings, writeSettings } from './shared'
import type { Settings } from './shared'
import { parseKeys } from './gemini'

type Toggle = 'meme' | 'memetext' | 'random' | 'ask' | 'rewrite' | 'shakespeare'

export default function SettingsScreen() {
	const React = vendetta.metro.common.React
	const RN = vendetta.metro.common.ReactNative
	const [state, setState] = React.useState(() => readSettings() as Settings)
	const [keys, setKeys] = React.useState(String(state.keys ?? ''))
	const [model, setModel] = React.useState(String(state.model ?? ''))
	const [savedAt, setSavedAt] = React.useState(0)
	const keyTimer = React.useRef(null)
	const modelTimer = React.useRef(null)
	// latest text regardless of when a handler was captured, a press or a blur
	// always writes what is actually in the box
	const latestKeys = React.useRef(String(state.keys ?? ''))
	const latestModel = React.useRef(String(state.model ?? ''))

	const toggle = (name: Toggle) => {
		const next = !state[name]
		writeSettings({ [name]: next } as Partial<Settings>)
		setState({ ...state, [name]: next })
	}

	/** tidy the box up, then hand it back to the storage */
	const cleanKeys = (raw: string) =>
		raw
			.split(/\r?\n/)
			.map((line: string) => line.trim())
			.filter(Boolean)
			.join('\n')

	const persistKeys = (raw: string) => {
		writeSettings({ keys: cleanKeys(raw) })
		setSavedAt(Date.now())
	}

	const persistModel = (raw: string) => {
		writeSettings({ model: raw.trim() })
		setSavedAt(Date.now())
	}

	// typing saves too. the old version only wrote on blur and a pasted block
	// never blurred on some keyboards, so only the old single key stayed behind
	const onChangeKeys = (text: string) => {
		latestKeys.current = text
		setKeys(text)
		if (keyTimer.current) clearTimeout(keyTimer.current)
		keyTimer.current = setTimeout(() => persistKeys(text), 700)
	}

	const onChangeModel = (text: string) => {
		latestModel.current = text
		setModel(text)
		if (modelTimer.current) clearTimeout(modelTimer.current)
		modelTimer.current = setTimeout(() => persistModel(text), 700)
	}

	const saveKeys = () => {
		if (keyTimer.current) clearTimeout(keyTimer.current)
		const value = cleanKeys(latestKeys.current)
		latestKeys.current = value
		setKeys(value)
		writeSettings({ keys: value })
		setState({ ...state, keys: value })
		setSavedAt(Date.now())
	}

	const saveModel = () => {
		if (modelTimer.current) clearTimeout(modelTimer.current)
		const value = latestModel.current.trim()
		latestModel.current = value
		setModel(value)
		writeSettings({ model: value })
		setState({ ...state, model: value })
		setSavedAt(Date.now())
	}

	const saved = parseKeys(keys).length

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
		multiline?: boolean
		hint?: string
	}) =>
		React.createElement(
			RN.View,
			{ key: config.label, style: styles.field },
			React.createElement(RN.Text, { style: styles.label }, config.label),
			React.createElement(RN.TextInput, {
				style: [styles.input, config.multiline ? styles.multiline : null],
				value: config.value,
				placeholder: config.placeholder,
				placeholderTextColor: '#6b6f76',
				autoCapitalize: 'none',
				autoCorrect: false,
				multiline: Boolean(config.multiline),
				onChangeText: config.onChange,
				onBlur: config.onBlur,
				onSubmitEditing: config.multiline ? undefined : config.onBlur,
			}),
			config.hint ? React.createElement(RN.Text, { style: styles.hint }, config.hint) : null,
		)

	return React.createElement(
		RN.ScrollView,
		{ style: styles.screen, contentContainerStyle: styles.content },
		React.createElement(RN.Text, { style: styles.section }, 'commands'),
		row('meme', '/meme', 'any template, top and bottom text, or a random one'),
		row('memetext', '/memetext', 'writes on the last picture posted in the channel'),
		row('random', '/random', 'posts a random meme'),
		row('ask', '/ask', 'asks gemini a question'),
		row('rewrite', '/r', 'fixes grammar and wording'),
		row('shakespeare', '/shakespeare', 'rewrites your line like shakespeare'),

		React.createElement(RN.Text, { style: styles.section }, 'gemini'),
		field({
			label: 'api keys',
			value: keys,
			placeholder: 'one key per line',
			onChange: onChangeKeys,
			onBlur: saveKeys,
			multiline: true,
			hint: saved
				? `${saved} key${saved === 1 ? '' : 's'} in the box, saved as you type. each one gets a turn until somebody answers`
				: 'paste one or more keys, one per line',
		}),
		React.createElement(
			RN.Pressable,
			{ onPress: saveKeys, style: styles.button },
			React.createElement(RN.Text, { style: styles.buttonText }, 'save keys'),
		),
		field({
			label: 'model',
			value: model,
			placeholder: 'gemini-2.5-flash',
			onChange: onChangeModel,
			onBlur: saveModel,
			hint: 'blank lets the plugin ask your key which models it has and pick a flash one',
		}),
		savedAt
			? React.createElement(RN.Text, { style: styles.hint }, 'saved. go back and run a command, no restart needed.')
			: null,
		React.createElement(
			RN.Text,
			{ style: styles.note },
			'free keys from aistudio.google.com/apikey. keys stay in this plugin storage on your phone and only go to google.',
		),
		React.createElement(
			RN.Text,
			{ style: styles.note },
			'google hands out the free tier per project, not per key. keys made under the same project all share the same 20 requests a day, so make extra keys on another google account.',
		),
		React.createElement(
			RN.Text,
			{ style: styles.note },
			'when a model runs out the plugin moves to the next model on that same key, lite and 2.0 included, then to the next key. you only see an error when the whole stack is empty.',
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
	multiline: { minHeight: 96, textAlignVertical: 'top' },
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
