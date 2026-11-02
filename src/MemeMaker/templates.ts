// ids pulled straight from api.memegen.link/templates, all of these exist.
// keep the list short, nobody wants to scroll 209 templates in a picker.
export const Templates = [
	'drake',
	'disastergirl',
	'doge',
	'fine',
	'fry',
	'gru',
	'harold',
	'interesting',
	'icanhas',
	'imsorry',
	'joker',
	'keanu',
	'kermit',
	'khaby-lame',
	'michael-scott',
	'money',
	'mordor',
	'morpheus',
	'older',
	'panik-kalm-panik',
	'patrick',
	'philosoraptor',
	'pigeon',
	'pooh',
	'rollsafe',
	'sadfrog',
	'saltbae',
	'seagull',
	'snek',
	'spiderman',
	'spongebob',
	'stonks',
	'stop-it',
	'success',
	'trump',
	'yodawg',
	'yuno',
	'facepalm',
	'feelsgood',
	'woman-cat',
	'wonka',
	'buzz',
	'cake',
	'captain',
	'astronaut',
	'aag',
]

export function randomTemplate() {
	return Templates[Math.floor(Math.random() * Templates.length)]
}

/** "this is fine" -> "this-is-fine", keeps pasted ids working */
export function cleanTemplate(input: string) {
	return input
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/^\/+|\/+$/g, '')
}
