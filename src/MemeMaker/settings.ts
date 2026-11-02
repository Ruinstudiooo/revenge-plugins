import { readSettings, writeSettings } from './shared'
import type { Settings } from './shared'

type Toggle = 'meme' | 'memetext' | 'random' | 'ask' | 'rewrite' | 'shakespeare'

export default function SettingsScreen() {
	const React = vendetta.metro.common.React
	const RN = vendetta.metro.common.ReactNative
	const [state, setState] = React.useState(() => readSettings() as Settings)
	const [key, setKey] = React.useState(state.apiKey)
	const [model, setModel] = React.useState(state.model)

	const toggle = (name: Toggle) => {
		const next = !state[name]
		writeSettings({ [name]: next } as Partial<Settings>)
		setState({ ...state, [name]: next })
	}

	const saveKey = () => {
		const value = key.trim()
		writeSettings({ apiKey: value })
		setState({ ...state, apiKey: value })
	}

	const saveModel = () => {
		const value = model.trim() || 'gemini-2.5-flash'
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

	const field = (
		label: string,
		value: string,
		onChange: (text: string) => void,
		onBlur: () => void,
		placeholder: string,
	) =>
		React.createElement(
			RN.View,
			{ style: styles.field },
			React.createElement(RN.Text, { style: styles.label }, label),
			React.createElement(RN.TextInput, {
				style: styles.input,
				value,
				placeholder,
				placeholderTextColor: '#6b6f76',
				autoCapitalize: 'none',
				autoCorrect: false,
				onChangeText: onChange,
				onBlur,
				onSubmitEditing: onBlur,
			}),
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
		field('api key', key, setKey, saveKey, 'paste your key here'),
		field('model', model, setModel, saveModel, 'gemini-2.5-flash'),
		React.createElement(
			RN.Text,
			{ style: styles.note },
			'free key from aistudio.google.com/apikey. the key is saved in this plugin storage on your phone and only goes to google.',
		),
		React.createElement(
			RN.Text,
			{ style: styles.note },
			'ask, r and shakespeare need the key. if one answers with a 404 the model name is wrong for your key, try gemini-2.0-flash.',
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
	note: { color: '#7f8489', fontSize: 12, marginTop: 10, lineHeight: 17 },
} as const
