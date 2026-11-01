import { build, context } from 'esbuild'
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

const watch = process.argv.includes('--watch')

/**
 * revenge evals a vendetta plugin as `vendetta => { return <the file> }`, so the file has
 * to be one big expression, not a few statements. bundle into a function and call it,
 * which leaves the plugin object as the expression result.
 */
function writer(name) {
	return {
		name: 'write-plugin',
		setup(build) {
			build.onEnd(result => {
				if (result.errors.length) return

				const body = result.outputFiles[0].text
				const file = `(function(){${body}\nreturn plugin && (plugin.default || plugin)\n})()`

				mkdirSync(name, { recursive: true })
				writeFileSync(`${name}/index.js`, file)

				const manifest = JSON.parse(readFileSync(`src/${name}/manifest.json`, 'utf8'))
				manifest.hash = createHash('sha256').update(file).digest('hex')
				writeFileSync(`${name}/manifest.json`, `${JSON.stringify(manifest, null, '\t')}\n`)

				console.log(`${name}/  ${manifest.hash.slice(0, 12)}`)
			})
		},
	}
}

const options = name => ({
	entryPoints: [`src/${name}/index.ts`],
	bundle: true,
	format: 'iife',
	globalName: 'plugin',
	target: ['es2019'],
	legalComments: 'none',
	write: false,
	plugins: [writer(name)],
})

const plugins = readdirSync('src', { withFileTypes: true })
	.filter(entry => entry.isDirectory())
	.map(entry => entry.name)

for (const name of plugins) {
	if (watch) {
		const ctx = await context(options(name))
		await ctx.watch()
	} else {
		await build(options(name))
	}
}

if (watch) console.log('watching src/')
