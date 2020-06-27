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

module.OPTION_PATTERN = /^--?/
module.COMMAND_PATTERN = /^[a-zA-Z]/


module.STOP = 
	{doc: 'stop option processing'}

module.ERROR = 
	{doc: 'option processing error'}



//---------------------------------------------------------------------

Object.defineProperty(String.prototype, 'raw', {
	get: function(){
		return this.replace(/\x1b\[..?m/g, '') }, })
	

// XXX add default...
// XXX add ability to clear defaults...
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
// basic argv parser...
//
// Format:
// 	{
// 		// alias...
// 		'-v': '-verbose',
// 		// handler...
// 		'-verbose': function(opt, rest){
// 			...
// 		},
//
//	    '-t': '-test',
//		'-test': {
//			doc: 'test option.',
//			arg: 'VALUE',
//			handler: function(value, opt, rest){ 
//				...
//			}},
//
//		command: function(){
//			...
//		},
// 		...
// 	}
//
// XXX add features:
// 		- option groups -- nested specs...
// 		- arg value type conversion???
// 		- make this a constructor???
// 		- extend this to support command calling...
// XXX should we handle <scriptName>-<command> script calls???
// XXX do we handle = for options with values???
// XXX move this to it's own lib...
// 		argv-handler
// 		ig-argv
// 		...
// XXX need better test processing:
// 		- line breaks
// 		- ...
var ArgvParser = 
module.ArgvParser =
function(spec){
	// spec defaults...
	// NOTE: this is intentionally not dynamic...
	spec = Object.assign({
		// builtin options...
		'-h': '-help',
		// XXX revise...
		'-help': {
			doc: 'print this message and exit.',
			handler: function(){
				var spec = this.spec
				var that = this
				var x
				console.log([
					`Usage: ${ 
						typeof(spec.__usage__) == 'function' ? 
							spec.__usage__.call(this) 
							: spec.__usage__ }`,
					// doc...
					...(spec.__doc__ ?
						['', typeof(spec.__doc__) == 'function' ?
							spec.__doc__()
							: spec.__doc__]
						: []),
					// options...
					'',
					'Options:',
					...(spec.__getoptions__()
						.map(function([opts, arg, doc]){
							return [opts.join(' | -') +' '+ (arg || ''), doc] })),
					// commands...
					...(((x = spec.__getcommands__()) && x.length > 0) ?
						['', 'Commands:', 
							...x.map(function([cmd, _, doc]){
								return [cmd.join(' | '), doc] })]
						: []),
					// examples...
					...(this.spec.__examples__ ?
						['', 'Examples:', ...(
							this.spec.__examples__ instanceof Array ?
								spec.__examples__
									.map(function(e){ 
										return e instanceof Array ? e : [e] })
								: spec.__examples__(this) )]
						: []),
					// footer...
					...(this.spec.__footer__?
						['', typeof(this.spec.__footer__) == 'function' ? 
							spec.__footer__(this) 
							: spec.__footer__]
						: []) ]
				.map(function(e){
					return e instanceof Array ?
						spec.__align__(...e
								.map(function(s){ 
									return s.replace(/\$scriptname/g, that.scriptname) }))
							// indent lists...
							.map(function(s){
								return '\t'+ s })
						: e })
				.flat()
				.join('\n')
				.replace(/\$scriptname/g, this.scriptname)) 

				process.exit() }},

		// special values and methods...
		__pre_check__: true,
		__opt_pattern__: module.OPTION_PATTERN,
		__cmd_pattern__: module.COMMAND_PATTERN,
		__opts_width__: 3,
		__doc_prefix__: '- ',

		// these is run in the same context as the handlers... (XXX ???)
		__align__: function(a, b, ...rest){
			var opts_width = this.__opts_width__ || 4
			var prefix = this.__doc_prefix__ || ''
			b = [b, ...rest].join('\n'+ ('\t'.repeat(opts_width+1) + ' '.repeat(prefix.length)))
			return b ?
				(a.raw.length < opts_width*8 ?
					[a +'\t'.repeat(opts_width - Math.floor(a.raw.length/8))+ prefix + b]
					: [a, '\t'.repeat(opts_width)+ prefix + b])
				: [a] },

		__usage__: function(){
			return `${ this.scriptname } [OPTIONS]` },
		__doc__: undefined,
		__examples__: undefined,
		__footer__: undefined,

		__unknown__: function(key){
			console.error('Unknown option:', key)
			process.exit(1) }, 

		// these are run in the context of spec...
		__getoptions__: function(...pattern){
			var that = this
			pattern = pattern.length == 0 ?
				[this.__opt_pattern__
					|| module.OPTION_PATTERN]
				: pattern
			return pattern
				.map(function(pattern){
					var handlers = {}
					Object.keys(that)
						.forEach(function(opt){
							// skip special methods...
							if(/^__.*__$/.test(opt) 
									|| !pattern.test(opt)){
								return }
							var [k, h] = that.__gethandler__(opt)
							handlers[k] ?
								handlers[k][0].push(opt)
								: (handlers[k] = [[opt], h.arg, h.doc || k, h]) })
					return Object.values(handlers) })
				.flat(1) },
		__iscommand__: function(str){
			return (this.__cmd_pattern__ 
					|| module.COMMAND_PATTERN)
				.test(str) 
				&& str in this },
		__getcommands__: function(){
			return this.__getoptions__(
				this.__cmd_pattern__ 
					|| module.COMMAND_PATTERN) },
		__gethandler__: function(key){
			key = key.replace(
				this.__opt_pattern__ 
					|| module.OPTION_PATTERN, 
				'-')
			var seen = new Set([key])
			while(key in this 
					&& typeof(this[key]) == typeof('str')){
				key = this[key] 
				// check for loops...
				if(seen.has(key)){
					throw Error('Option loop detected: '+ ([...seen, key].join(' -> '))) }
				seen.add(key) }
			return [key, this[key]] },
	}, spec)

	// sanity check -- this will detect argument loops for builtin opts 
	// and commands...
	spec.__pre_check__
		&& spec.__getoptions__(
			spec.__opt_pattern__ || module.OPTION_PATTERN,
			spec.__cmd_pattern__ || module.COMMAND_PATTERN)

	return function(argv){
		var opt_pattern = spec.__opt_pattern__ 
			|| module.OPTION_PATTERN
		argv = argv.slice()
		var context = {
			spec: spec,
			argv: argv.slice(),

			interpreter: argv.shift(),
			script: argv[0],
			scriptname: argv.shift().split(/[\\\/]/).pop(),

			rest: argv,
		}
		var unhandled = []
		while(argv.length > 0){
			var arg = argv.shift()
			var type = opt_pattern.test(arg) ?
					'opt'
				: spec.__iscommand__(arg) ?
					'cmd'
				: 'unhandled'
			// options / commands...
			if(type != 'unhandled'){
				// get handler...
				var handler = spec.__gethandler__(arg).pop()
						|| spec.__unknown__
				// get option value...
				var value = (handler.arg && !opt_pattern.test(argv[0])) ?
						argv.shift()
					: undefined
				// run handler...
				;(typeof(handler) == 'function' ?
						handler
						: handler.handler)
					.call(context, 
						// pass value...
						...(handler.arg ? [value] : []), 
						arg, 
						argv)
				continue }
			// unhandled...
			unhandled.push(arg) }
		return unhandled } }



//
//	Parser(spec)
//		-> parser
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
// XXX should we handle <scriptName>-<command> script calls???
var Parser =
module.Parser =
object.Constructor('Parser', {
	// config...
	optionPrefix: '-',
	commandPrefix: '@',
	
	// NOTE: this and .commandPattern are "input" patterns, i.e. both
	// 		are used to test strings the user provided and not how the
	// 		commands/potions are named internally...
	optionPattern: /^--?(.*)$/,
	commandPattern: /^([a-zA-Z].*)$/,


	// instance stuff...
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
	// XXX should these be .getOptions(..) / .getCommands(..) ???
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
						var [k, h] = that.getHandler(opt)
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
		return this.commandPattern.test(str) 
			&& (this.commandPrefix + str) in this },

	// NOTE: this ignores options forming alias loops and dead-end 
	// 		options...
	getHandler: function(key){
		key = this.optionPattern.test(key) ?
			key.replace(this.optionPattern, this.optionPrefix+'$1')
			: key.replace(this.commandPattern, this.commandPrefix+'$1')
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
			(a.raw.length < opts_width*8 ?
				[a +'\t'.repeat(opts_width - Math.floor(a.raw.length/8))+ prefix + b]
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

			// XXX should we explicitly exit here or in the runner???
			return module.STOP }},

	// common short-hands...
	// NOTE: defining this as a loop will enable the user to define any 
	// 		of the aliases as the handler and thus breaking the loop...
	// NOTE: unless the loop is broken this set of options is not usable.
	'-v': '-verbose',
	'-verbose': '-v',


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
	// NOTE: this is mainly needed to handle dynamic arguments...
	handleArgument: function(_, key){
		if(arguments.length == 1 && arguments[0] == 'doc'){
			return undefined }
		console.error('Unknown '+ (key.startsWith('-') ? 'option:' : 'command:'), key)
		return module.ERROR }, 

	// NOTE: if this is set to false Parser will not call process.exit(..)
	handleErrorExit: function(arg){
		process.exit(1) },

	// post parsing callbacks...
	then: afterCallback('parsing'),
	stop: afterCallback('stop'),
	error: afterCallback('error'),

	//
	//	parser(argv)
	//		-> unprocessed
	//
	// NOTE: this (i.e. parser) can be used as a nested command/option 
	// 		handler...
	__call__: function(context, argv){
		var that = this
		var nested = false

		// default argv...
		argv = argv == null ?
			process.argv.slice()
			: argv
		// XXX need to normalize argv...
		// XXX ...strip out the interpreter if it is given...

		// nested command handler...
		// XXX the condition is a bit too strong...
		if(context instanceof Parser){
			var rest = this.rest = argv.slice()
			this.script = this.scriptName = 
				context.scriptName +' '+ arguments[2]
			this.argv = [context.scriptName, this.scriptName, ...argv]
			nested = true

		// root parser...
		} else {
			var rest = this.rest = argv.slice()
			this.argv = argv.slice()
			// XXX revise this...
			// 		- when run from node -- [<node>, <script>, ...]
			// 		- when run from electron -- [<electron>, ...]
			// 			require('electron').remove.process.argv
			this.interpreter = rest.shift()
			this.script = rest[0]
			this.scriptName = rest.shift().split(/[\\\/]/).pop()
		}

		var opt_pattern = this.optionPattern

		var unhandled = []
		while(argv.length > 0){
			var arg = argv.shift()
			var type = opt_pattern.test(arg) ?
					'opt'
				: this.isCommand(arg) ?
					'cmd'
				: 'unhandled'
			// options / commands...
			if(type != 'unhandled'){
				// get handler...
				var handler = this.getHandler(arg)[1]
						|| this.handleArgument
				// get option value...
				var value = (handler.arg && !opt_pattern.test(argv[0])) ?
						argv.shift()
					: undefined
				// run handler...
				var res = (typeof(handler) == 'function' ?
						handler
						: handler.handler)
					.call(this, 
						argv,
						arg,
						...(handler.arg ? [value] : []))
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
* vim:set ts=4 sw=4 :                               */ return module })
