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

	const toggle = (name: Toggle) => {
		const next = !state[name]
		writeSettings({ [name]: next } as Partial<Settings>)
		setState({ ...state, [name]: next })
	}

	const saved = parseKeys(keys).length

	const saveKeys = () => {
		const value = keys
			.split(/\r?\n/)
			.map((line: string) => line.trim())
			.filter(Boolean)
			.join('\n')

		setKeys(value)
		writeSettings({ keys: value })
		setState({ ...state, keys: value })
	}

	const saveModel = () => {
		const value = model.trim()
		setModel(value)
		writeSettings({ model: value })
		setState({ ...state, model: value })
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
			onChange: setKeys,
			onBlur: saveKeys,
			multiline: true,
			hint: saved
				? `${saved} key${saved === 1 ? '' : 's'} saved, used in this order and the next one takes over when one fails`
				: 'paste one or more keys, one per line',
		}),
		field({
			label: 'model',
			value: model,
			placeholder: 'gemini-2.5-flash',
			onChange: setModel,
			onBlur: saveModel,
			hint: 'blank lets the plugin ask your key which models it has and pick a flash one',
		}),
		React.createElement(
			RN.Text,
			{ style: styles.note },
			'free keys from aistudio.google.com/apikey. keys stay in this plugin storage on your phone and only go to google.',
		),
		React.createElement(
			RN.Text,
			{ style: styles.note },
			'a 404 on a model name is handled for you now, the plugin lists what the key can use instead of guessing. every key gets its own turn, so a dead or rate limited one just moves the request along.',
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
	hint: { color: '#7f8489', fontSize: 12, lineHeight: 16 },
	note: { color: '#7f8489', fontSize: 12, marginTop: 10, lineHeight: 17 },
} as const
