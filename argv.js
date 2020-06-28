/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var object = require('ig-object')



//---------------------------------------------------------------------

module.STOP = 
	{doc: 'stop option processing'}

module.ERROR = 
	{doc: 'option processing error'}



//---------------------------------------------------------------------
// helpers...

var afterCallback = function(name){
	var attr = '__after_'+ name
	return function(func){
		(this[attr] = this[attr] || []).push(func)
		return this } }


var afterCallbackCall = function(name, context, ...args){
	return (context['__after_'+ name] || [])
		.forEach(function(func){
			func.call(context, ...args) }) }



//---------------------------------------------------------------------
// Basic argv parser...
//
//
//	Parser(spec)
//		-> parser
//
//
// spec format:
// 	{
// 		// option alias...
// 		'-v': '-verbose',
// 		// options handler (basic)...
// 		'-verbose': function(opts, key, value){
// 			...
// 		},
//
//	    // option handler (full)...
//	    // NOTE: the same attributes (except for .handler) can be set on 
//	    //		the function handler above to same effect...
//	    '-t': '-test',
//		'-test': {
//			doc: 'test option.',
//			arg: 'VALUE',
//			handler: function(opts, key, value){ 
//				...
//			}},
//
//		// command...
//		//
//		// NOTE: commands are the same as options in every way other than
//		//		call syntax.
//		// NOTE: it is possible to alias options to commands and vice-versa...
//		'@command': ... ,
//
//
//		// nested parsers...
//		//
//		// NOTE: the nested parser behaves the same as if it was root and 
//		//		can consume as many argv elements as it needs, effectively 
//		//		rendering the relevant options as context sensitive, e.g.:
//		//			cmd -h				# get root help...
//		//			cmd nest -h			# get help for @nest command...
//		// NOTE: a nested parser can be either an option or a command...
//		@nest: new Parser({
//				doc: 'nested parser',
//
//				'-nested-option': {
//					...
//				},
//			})
//			.then(function(){
//				...
//			}),
//
//		...
// 	}
//
//
// XXX should .options(..), .commands(..) and .handler(..) be:
// 		.getOptions(..), .getCommands(..) and .getHandler(..) respectively???
// XXX should we handle <scriptName>-<command> script calls???
var Parser =
module.Parser =
object.Constructor('Parser', {
	// config...
	optionPrefix: '-',
	commandPrefix: '@',
	
	// NOTE: we only care about differentiating an option from a command
	// 		here by design...
	optionInputPattern: /^--?(.*)$/,
	commandInputPattern: /^([a-zA-Z].*)$/,


	// instance stuff...
	// XXX revise...
	argv: null,
	rest: null,
	scriptNmae: null,
	scriptPath: null,


	// Handler API...
	//
	// Format:
	// 	[
	// 		[<keys>, <arg>, <doc>, <handler>],
	// 		...
	// 	]
	//
	// XXX add option groups...
	options: function(...prefix){
		var that = this
		prefix = prefix.length == 0 ?
			[this.optionPrefix]
			: prefix
		return prefix
			.map(function(prefix){
				var handlers = {}
				object.deepKeys(that, Parser.prototype)
					.forEach(function(opt){
						if(!opt.startsWith(prefix)){
							return }
						var [k, h] = that.handler(opt)
						h !== undefined
							&& (handlers[k] ?
								handlers[k][0].push(opt)
								: (handlers[k] = [ [opt], h.arg, h.doc || k.slice(1), h ])) })
				return Object.values(handlers) })
			.flat(1) 
			.map(function(e, i){ return [e, i] })
			.sort(function([a, ai], [b, bi]){
				a = a[3].priority
				b = b[3].priority
				return a != null && b != null ?
						b - a
					// positive priority above order, negative below...
					: (a > 0 || b < 0) ?
						-1
					: (b < 0 || a > 0) ?
						1
					: ai - bi })
			.map(function([e, _]){ return e }) },
	commands: function(){
		return this.options(this.commandPrefix) },

	isCommand: function(str){
		return this.commandInputPattern.test(str) 
			&& (this.commandPrefix + str) in this },

	// NOTE: this ignores options forming alias loops and dead-end 
	// 		options...
	handler: function(key){
		var value
		key = this.optionInputPattern.test(key) ?
			key.replace(this.optionInputPattern, this.optionPrefix+'$1')
			: key.replace(this.commandInputPattern, this.commandPrefix+'$1')
		var seen = new Set([key])
		while(key in this 
				&& typeof(this[key]) == typeof('str')){
			key = this[key] 
			// check for loops...
			if(seen.has(key)){
				return [key, undefined,
					// report loop...
					'loop', [...seen, key]] }
				//throw new Error('Option loop detected: '+ ([...seen, key].join(' -> '))) }
			seen.add(key) }
		return [key, this[key],
			// report dead-end if this[key] is undefined...
			...(this[key] ? 
				[]
				: ['dead-end'])] },


	// XXX need to test option definitions... (???)
	// 		i.e. report loops and dead ends...


	// doc stuff...
	helpColumnOffset: 3,
	helpColumnPrefix: '- ',

	usage: '$SCRIPTNAME [OPTIONS]',
	doc: undefined,
	examples: undefined,
	footer: undefined,

	alignColumns: function(a, b, ...rest){
		var opts_width = this.helpColumnOffset || 4
		var prefix = this.helpColumnPrefix || ''
		b = [b, ...rest].join('\n'+ ('\t'.repeat(opts_width+1) + ' '.repeat(prefix.length)))
		return b ?
			(a.strip.length < opts_width*8 ?
				[a +'\t'.repeat(opts_width - Math.floor(a.strip.length/8))+ prefix + b]
				: [a, '\t'.repeat(opts_width)+ prefix + b])
			: [a] },

	// Builtin options/commands...
	'-h': '-help',
	'-help': {
		doc: 'print this message and exit.',
		priority: 99,
		handler: function(argv, key, value){
			var that = this

			var expandVars = function(str){
				return str
					.replace(/\$SCRIPTNAME/g, that.scriptName) }
			var getValue = function(name){
				return that[name] ?
					['', typeof(that[name]) == 'function' ?
						that[name]()
						: that[name]]
		   			: [] }
			var section = function(title, items){
				items = items instanceof Array ? items : [items]
				return items.length > 0 ?
					['', title +':', ...items]
					: [] }

			console.log(
				expandVars([
					`Usage: ${ getValue('usage').join('') }`,
					// doc (optional)...
					...getValue('doc'),
					// options...
					// XXX add option groups...
					...section('Options',
						this.options()
							.map(function([opts, arg, doc]){
								return [ 
									opts
										.sort(function(a, b){ 
											return a.length - b.length})
										.join(' | -') 
											+' '+ (arg || ''), 
									doc] })),
					// dynamic options...
					...section('Dynamic options',
						this.handleArgument ? 
							this.handleArgument('doc') || [] 
							: []),
					// commands (optional)...
					...section('Commands',
						this.commands()
							.map(function([cmd, _, doc]){
								return [
									cmd
										.map(function(cmd){ return cmd.slice(1)})
										.join(' | '), 
									doc] })),
					// examples (optional)...
					...section('Examples',
						this.examples instanceof Array ?
							this.examples
								.map(function(e){ 
									return e instanceof Array ? e : [e] })
						: getValue('examples') ),
					// footer (optional)...
					...getValue('footer') ]
				// expand/align columns...
				.map(function(e){
					return e instanceof Array ?
						// NOTE: we need to expandVars(..) here so as to 
						// 		be able to calculate actual widths...
						that.alignColumns(...e.map(expandVars))
							.map(function(s){ return '\t'+ s })
						: e })
				.flat()
				.join('\n')))
			return module.STOP }},

	// common short-hands...
	// NOTE: defining this as a loop will enable the user to define any 
	// 		of the aliases as the handler and thus breaking the loop...
	// NOTE: unless the loop is broken this set of options is not usable.
	'-v': '-verbose',
	'-verbose': '-v',


	// Handle arguments with no explicit handlers found...
	//
	// 	Handle dynamic/unknown argument...
	// 	.handleArgument(args, arg)
	// 		-> module.ERROR
	// 		-> module.STOP
	// 		-> result
	//
	// 	Get dynamic argument doc...
	// 	.handleArgument('doc')
	// 		-> undefined
	// 		-> doc
	//
	//
	// doc format:
	// 	[
	// 		[<option-spec>, <doc>],
	// 		...
	// 	]
	//
	//
	// NOTE: this is mainly needed to handle dynamic arguments or print 
	// 		error on unknown options (default)...
	handleArgument: function(_, key){
		if(arguments.length == 1 && arguments[0] == 'doc'){
			return undefined }
		console.error('Unknown '+ (key.startsWith('-') ? 'option:' : 'command:'), key)
		return module.ERROR }, 

	// Handle argument value conversion...
	//
	// If this is false/undefined value is passed to the handler as-is...
	//
	// Example:
	//		handleArgumentValue: function(handler, value){
	//			// process handler value type definition or infer type 
	//			// and convert...
	//			return value },
	handleArgumentValue: false,

	// Handle error exit...
	//
	// If this is set to false Parser will not call process.exit(..) on 
	// error...
	handleErrorExit: function(arg){
		process.exit(1) },

	// post parsing callbacks...
	//
	// 	.then(callback(unhandleed))
	//
	// 	.stop(callback(arg))
	//
	// 	.error(callback(arg))
	//
	//
	// XXX need to document the arguments to each handler/callback...
	// XXX .then(..) passes the full list of unhandleed args including 
	// 		argv[0] and argv[1]...
	then: afterCallback('parsing'),
	stop: afterCallback('stop'),
	error: afterCallback('error'),

	//
	//	parser(argv)
	//		-> unprocessed
	//
	// NOTE: this (i.e. parser) can be used as a nested command/option 
	// 		handler...
	//
	// XXX ARGV: need to normalize argv -- strip out the interpreter if it is given...
	__call__: function(context, argv){
		var that = this
		var nested = false

		// default argv...
		argv = (argv == null ?
				process.argv
				: argv)
			.slice()
		var rest = this.rest = argv.slice()

		// XXX ARGV: strip out the interpreter if it is given... (???)

		// nested command handler...
		// XXX the condition is a bit too strong...
		if(context instanceof Parser){
			this.script = this.scriptName = 
				context.scriptName +' '+ arguments[2]
			this.argv = [context.scriptName, this.scriptName, ...argv]
			nested = true

		// root parser...
		} else {
			this.argv = argv.slice()
			// XXX ARGV: revise this...
			// 		- when run from node -- [<node>, <script>, ...]
			// 		- when run from electron -- [<electron>, ...]
			// 			require('electron').remove.process.argv
			this.interpreter = rest.shift()
			this.script = rest[0]
			this.scriptName = rest.shift().split(/[\\\/]/).pop()
		}

		var opt_pattern = this.optionInputPattern

		var unhandled = []
		while(rest.length > 0){
			var [arg, value] = rest.shift().split(/=/)
			var type = opt_pattern.test(arg) ?
					'opt'
				: this.isCommand(arg) ?
					'cmd'
				: 'unhandled'
			// options / commands...
			if(type != 'unhandled'){
				// get handler...
				var handler = this.handler(arg)[1]
						|| this.handleArgument
				// get option value...
				value = value 
					|| ((handler.arg && !opt_pattern.test(rest[0])) ?
							rest.shift()
						: undefined)
				// value conversion...
				value = value && this.handleArgumentValue ?
					this.handleArgumentValue(handler, value)
					: value
				// run handler...
				var res = (typeof(handler) == 'function' ?
						handler
						: handler.handler)
					.call(this, 
						rest,
						arg,
						...(value ? [value] : []))
				// handle .STOP / .ERROR
				if(res === module.STOP || res === module.ERROR){
					afterCallbackCall(
						res === module.STOP ? 'stop' : 'error', 
						this, arg)
					res === module.ERROR
						&& this.handleErrorExit
						&& this.handleErrorExit(arg)
					return nested ? 
						res
			   			: this }
				continue }
			// unhandled...
			unhandled.push(arg) }

		// post handlers...
		afterCallbackCall('parsing', this, unhandled)
		return this },

	// NOTE: see general doc...
	__init__: function(spec){
		Object.assign(this, spec) },
})




/**********************************************************************
* vim:set ts=4 sw=4 nowrap :                        */ return module })
