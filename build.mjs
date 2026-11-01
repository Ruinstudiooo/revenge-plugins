import { build, context } from 'esbuild'
import { readdirSync } from 'node:fs'

/**
 * classic revenge evaluates a bundle as `(bunny, definePlugin) => { <code>; return plugin?.default ?? plugin }`,
 * so the output has to land in a top level `plugin` variable. format iife + globalName does that.
 */
const plugins = readdirSync('src', { withFileTypes: true })
	.filter(entry => entry.isDirectory())
	.map(entry => entry.name)

const options = name => ({
	entryPoints: [`src/${name}/index.ts`],
	outfile: `builds/${name}/index.js`,
	bundle: true,
	format: 'iife',
	globalName: 'plugin',
	target: ['es2019'],
	legalComments: 'none',
})

if (process.argv.includes('--watch')) {
	for (const name of plugins) {
		const ctx = await context(options(name))
		await ctx.watch()
	}
	console.log(`watching src/ for ${plugins.join(', ')}`)
} else {
	for (const name of plugins) {
		await build(options(name))
		console.log(`built builds/${name}/index.js`)
	}
}
