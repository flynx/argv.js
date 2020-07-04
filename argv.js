/**********************************************************************
* 
* argv.js
*
* A simple argv parser
*
* Motivation:
*	I needed a new argv parser for a quick and dirty project I was working 
*	on and evaluating and selecting the proper existing parser and then 
*	learning its API, quirks and adapting the architecture to it seemed 
*	to be more complicated, require more effort and far less fun than 
*	putting together a trivial parser myself in a couple of hours.  
*	This code is an evolution of that parser.
*
* Repo and docs:
* 	https://github.com/flynx/argv.js
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var object = require('ig-object')



//---------------------------------------------------------------------

module.STOP = 
	{doc: 'stop option processing, triggers .stop(..) handlers'}

// XXX rename???
module.THEN = 
	{doc: 'break option processing, triggers .then(..) handlers'}

module.ERROR = 
	{doc: 'option processing error, triggers .error(..) handlers'}



//---------------------------------------------------------------------
// helpers...

// XXX do we need to remove handlers???
// XXX does this need to be an event constructor???
var afterCallback = function(name){
	var attr = '__after_'+ name
	return function(func){
		var that = this
		var args = [...arguments]
		;(args.length == 1 && typeof(func) == 'function') ?
			// add handler...
			(this[attr] = this[attr] || []).push(func)
			// call handlers...
			: (this[attr] || [])
				.forEach(function(func){
					func.call(that, ...args) })
		return this } }



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
//			doc: 'test option',
//
//			arg: 'VALUE',
//
//			env: 'VALUE',
//
//			default: 123,
//
//			required: true,
//
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
//
// General runtime architecture:
//
// 		Parser(..) -> parser(..) -> result
//
//	Parse(..) 
//		- constructs a parser object (instance)
//	parse(..) 
//		- parse is instance of Parse
//		- contains the parsing configuration / grammar
//		- parses the argv
//		- creates/returns a result object
//	result 
//		- parse is prototype of result
//		- contains all the data resulting from the parse
//
//
//
// It is recommended not to do any processing with side-effects in 
// option/command handlers directly, prepare for the execution and to 
// the actual work in the .then(..) callback. The reason being that the 
// option handlers are called while parsing options and thus may not 
// yet know of any error or stop conditions triggered later in the argv.
//
//
//
//
// NOTE: essentially this parser is a very basic stack language...
// 		XXX can we implement the whole thing directly as a stack language???
//
// XXX might be a good idea to read metadata from package.json
// XXX might be a good idea to add a default .handler -- if a user does 
// 		not define a .handler just set a value... the question is on what?
// XXX might also be a good idea to return clone rather than this... i.e.
// 		treat the parser object as a result factory...
// 		...this would resolve any issues with misxing parse state with 
// 		grammer... etc.
// XXX handle option types???
// XXX --help should work for any command and not just for the nested 
// 		parser commands... (???)
// 		...not sure how to implement this...
// 		.....or should it be the responsibility of the user defining 
// 		the command???
// XXX should we handle <scriptName>-<command> script calls???
// XXX should .options(..), .commands(..) and .handler(..) be:
// 		.getOptions(..), .getCommands(..) and .getHandler(..) respectively???
var Parser =
module.Parser =
object.Constructor('Parser', {
	// config...
	splitOptions: true,
	optionPrefix: '-',
	commandPrefix: '@',
	// NOTE: we only care about differentiating an option from a command
	// 		here by design...
	optionInputPattern: /^--?(.*)$/,
	commandInputPattern: /^([a-zA-Z].*)$/,

	// instance stuff...
	argv: null,
	pre_argv: null,
	rest: null,

	scriptNmae: null,
	scriptPath: null,


	// output...
	// XXX is this the right way to go???
	print: function(...args){
		console.log(...args)
		return this },
	printError: function(...args){
		console.error(...args)
		return this },


	// Handler API...
	//
	// Format:
	// 	[
	// 		[<keys>, <arg>, <doc>, <handler>],
	// 		...
	// 	]
	//
	// XXX do we need to output <doc> here???
	// 		...if it's used only in -help then it would be simpler to 
	// 		remove it from here and get everything in formDoc(..), same 
	// 		goes for <arg>...
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
	optionsWithValue: function(){
		return this.options()
			.filter(function([k, a, d, handler]){
				return !!handler.env 
					|| 'default' in handler }) },
	requiredOptions: function(){
		return this.options()
			.filter(function([k, a, d, handler]){
				return handler.required }) },
	commands: function(){
		return this.options(this.commandPrefix) },
	isCommand: function(str){
		return this.commandInputPattern.test(str) 
			&& (this.commandPrefix + str) in this },
	// NOTE: this ignores any arguments values present in the key...
	// NOTE: this ignores options forming alias loops and dead-end 
	// 		options...
	handler: function(key){
		// clear arg value...
		key = key.split(/=/).shift()
		// option or command?
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

	// Builtin options/commands and their configuration...
	
	// Help...
	//
	// doc config...
	helpColumnOffset: 3,
	helpColumnPrefix: '- ',
	//helpOptionSeparator: ' | ',
	helpArgumentSeparator: ', ',
	//helpValueSeparator: '=',
	helpValueSeparator: ' ',

	// doc sections...
	// XXX might be a good idea to read these from package.json by default...
	// XXX
	author: undefined,
	license: undefined,
	usage: '$SCRIPTNAME [OPTIONS]',
	doc: undefined,
	// XXX test this with string value...
	examples: undefined,
	// XXX add license and version info...
	//footer: '$SCRIPTNAME v:$VERSION',
	footer: undefined,

	// XXX should wrap long lines...
	alignColumns: function(a, b, ...rest){
		var opts_width = this.helpColumnOffset || 4
		var prefix = this.helpColumnPrefix || ''
		b = [b, ...rest].join('\n'+ ('\t'.repeat(opts_width+1) + ' '.repeat(prefix.length)))
		return b ?
			(a.strip.length < opts_width*8 ?
				[a +'\t'.repeat(opts_width - Math.floor(a.strip.length/8))+ prefix + b]
				: [a, '\t'.repeat(opts_width)+ prefix + b])
			: [a] },
	expandTextVars: function(text){
		return text
			.replace(/\$AUTHOR/g, this.author || 'Author')
			.replace(/\$LICENSE/g, this.license || '')
			.replace(/\$VERSION/g, this.version || '0.0.0')
			.replace(/\$SCRIPTNAME/g, this.scriptName) },

	'-h': '-help',
	'-help': {
		doc: 'print this message and exit',
		priority: 99,
		handler: function(argv, key, value){
			var that = this
			var sep = this.helpArgumentSeparator
			var expandVars = this.expandTextVars.bind(this)
			var formDoc = function(doc, handler){
				var info = [
					...(handler.required ?
						['Required']
						: []),
					...('default' in handler ?
						[`Default: ${handler.default}`]
						: []),
					...(handler.env ?
						[`Env: \$${handler.env}`]
						: []),
				].join(', ')
				return [doc, 
					...(info.length > 0 ?
						['('+ info +')']
						: [])] }
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

			this.print(
				expandVars([
					`Usage: ${ getValue('usage').join('') }`,
					// doc (optional)...
					...getValue('doc'),
					// options...
					// XXX add option groups...
					...section('Options',
						this.options()
							.filter(function([o, a, doc]){
								return doc !== false })
							.map(function([opts, arg, doc, handler]){
								return [ 
									[opts
										.sort(function(a, b){ 
											return a.length - b.length})
										.map(function(o, i){
											return o.length <= 2 ? 
													o 
												// no short options -> offset first long option...
												: i == 0 ?
													' '.repeat(sep.length + 2) +'-'+ o
												// add extra '-' to long options...
												: '-'+ o })
										.join(sep),
										...(arg ? 
											[arg] 
											: [])]
										.join(that.helpValueSeparator), 
									...formDoc(doc, handler) ] })),
					// dynamic options...
					...section('Dynamic options',
						this.handleArgument ? 
							this.handleArgument('doc') || [] 
							: []),
					// commands (optional)...
					...section('Commands',
						this.commands()
							.map(function([cmd, arg, doc, handler]){
								return [
									[cmd
										.map(function(cmd){ return cmd.slice(1)})
										.join(sep),
										...(arg ? 
											[arg] 
											: [])]
										.join(that.helpValueSeparator), 
									...formDoc(doc, handler) ] })),
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


	// Version...
	//
	version: undefined,

	'-v': '-version',
	'-version': {
		doc: 'show $SCRIPTNAME verion and exit',
		priority: 99,
		handler: function(){
			this.print(this.version || '0.0.0')
			return module.STOP }, },


	// Stop processing arguments and continue into .then(..) handlers...
	//
	// If .then(..) does not handle rest in the nested context then this
	// context will be returned to the parent context, effectively 
	// stopping the nested context and letting the parent continue.
	//
	// XXX should we be able to force the parent/root to also stop???
	// 		...this can be done by pushing '-' to the rest's head...
	'-': {
		doc: 'stop processing arguments after this point',
		handler: function(){
			return module.THEN }, },
	

	// common short-hands...
	//
	// NOTE: defining this as a loop will enable the user to define any 
	// 		of the aliases as the handler and thus breaking the loop...
	// NOTE: unless the loop is broken this set of options is not usable.
	//'-v': '-verbose',
	//'-verbose': '-v',


	// Default handler action...
	//
	// This is called when .handler is not set...
	handlerDefault: function(handler, rest, key, value){
		key = handler.key
			|| handler.arg
			// get the final key...
			|| this.handler(key)[0].slice(1)
		this[key] = value === undefined ?
			true
			: value
		return this },


	// Handle arguments with no explicit handlers found...
	//
	// 	Handle dynamic/unknown argument...
	// 	.handleArgument(args, arg)
	// 		-> module.ERROR
	// 		-> module.STOP
	// 		-> module.THEN
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
		// doc handler...
		if(arguments.length == 1 && arguments[0] == 'doc'){
			return undefined }
		this.printError('Unknown '+ (key.startsWith('-') ? 'option:' : 'command:'), key)
		return module.ERROR }, 

	// Handle argument value conversion...
	//
	// If this is false/undefined value is passed to the handler as-is...
	//
	// Example:
	// 		typeHandler: {
	// 			int: parseInt,
	// 			float: parseFloat,	
	// 			number: function(v){ return new Number(v) },
	// 			string: function(v){ return v.toString() },
	// 			...
	// 		},
	//		handleArgumentValue: function(handler, value){
	//			var convert = typeof(handler.type) == 'function' ?
	//				handler.type
	//				: this.typeHandler[handler.type]
	//			return convert ?
	//				convert(value)
	//				: value },
	//
	// XXX should we define a handler.type handler???
	handleArgumentValue: false,

	// Handle error exit...
	//
	// If this is set to false Parser will not call process.exit(..) on 
	// error...
	handleErrorExit: function(arg){
		typeof(process) != 'unhandled'
			&& process.exit(1) },


	// post parsing callbacks...
	//
	// 	.then(callback(unhandleed, root_value, rest))
	//
	// 	.stop(callback(arg, rest))
	// 	.error(callback(reason, arg, rest))
	//
	then: afterCallback('parsing'),
	stop: afterCallback('stop'),
	error: afterCallback('error'),

	// remove callback...
	off: function(evt, handler){
		var l = this['__after_'+evt]
		var i = l.indexOf(handler)
		i >= 0
			&& l.splice(i, 1)
		return this },


	//
	//	parser()
	//		-> result
	//
	//	parser(argv)
	//		-> result
	//
	//	parser(argv, main)
	//		-> result
	//
	// NOTE: the result is an object inherited from parser and containing 
	// 		all the parse data...
	// NOTE: this (i.e. parser) can be used as a nested command/option 
	// 		handler...
	//
	__call__: function(context, argv, main, root_value){
		var parsed = Object.create(this)
		var nested = parsed.nested = false
		var rest = parsed.rest = 
			argv == null ?
				(typeof(process) != 'unhandled' ?
					process.argv 
					: [])
				: argv
		parsed.argv = rest.slice() 
		main = main 
			|| require.main.filename
		// nested command handler...
		if(context instanceof Parser){
			nested = parsed.nested = true
			main = context.scriptName +' '+ main 
			rest.unshift(main) }
		// normalize the argv...
		if(main != null){
			parsed.pre_argv = rest.splice(0, rest.indexOf(main))
			rest.includes(main)
				|| rest.unshift(main) }
		// script stuff...
		var script = parsed.script = rest.shift()
		parsed.scriptName = script.split(/[\\\/]/).pop() 
		parsed.scriptPath = script.slice(0, 
			script.length - parsed.scriptName.length)

		var opt_pattern = parsed.optionInputPattern

		// helpers...
		var handleError = function(reason, arg, rest){
			parsed.error(reason, arg, rest)
			parsed.handleErrorExit
				&& parsed.handleErrorExit(arg, reason) }
		var defaultHandler = function(handler){
			return function(rest, arg, value) {
				return parsed.handlerDefault(handler, rest, arg, value) } }
		var runHandler = function(handler, arg, rest){
			var [arg, value] = arg.split(/=/)
			// get option value...
			value = value == null ?
				((handler.arg && !opt_pattern.test(rest[0])) ?
						rest.shift()
					: (typeof(process) != 'undefined' && handler.env) ?
						(process.env[handler.env] 
							|| handler.default)
					: handler.default)
				: value
			// value conversion...
			value = (value != null 
					&& parsed.handleArgumentValue) ?
				parsed.handleArgumentValue(handler, value)
				: value
			// run handler...
			var res = (typeof(handler) == 'function' ?
					handler
					: (handler.handler 
						|| defaultHandler(handler)))
				.call(parsed, 
					rest,
					arg,
					...(value != null ? 
						[value] 
						: []))
			// handle .STOP / .ERROR
			res === module.STOP
				&& parsed.stop(arg, rest)
			// XXX might be a good idea to use exceptions for this...
			res === module.ERROR
				// XXX is this the correct reason???
				&& handleError('unknown', arg, rest)
			return res }
		// NOTE: if successful this needs to modify the arg, thus it 
		// 		returns both the new first arg and the handler...
		var splitArgs = function(arg, rest){
			var [arg, value] = arg.split(/=/)
			// skip single letter unknown options or '--' options...
			if(arg.length <= 2 
					|| arg.startsWith(parsed.optionPrefix.repeat(2))){
				return undefined }
			// split and normalize...
			var [a, ...r] = 
				[...arg.slice(1)]
					.map(function(e){ return '-'+ e })
			// push the value to the last arg...
			value !== undefined
				&& r.push(r.pop() +'='+ value) 
			// push new options back to option "stack"...
			rest.splice(0, 0, ...r)
			var handler = parsed.handler(a)[1]
			return handler 
				&& [a, handler] }

		var values = new Set()
		var seen = new Set()
		var unhandled = []
		while(rest.length > 0){
			var arg = rest.shift()
			var type = opt_pattern.test(arg) ?
					'opt'
				: parsed.isCommand(arg) ?
					'cmd'
				: 'unhandled'
			// options / commands...
			if(type != 'unhandled'){
				// get handler...
				var handler = parsed.handler(arg)[1]
					// handle merged options
					// NOTE: if successful returns array...
					|| (type == 'opt' 
						&& parsed.splitOptions
						&& splitArgs(arg, rest))
					// dynamic or error...
					|| parsed.handleArgument
				// normalize output of splitArgs(..)
				;[arg, handler] = handler instanceof Array ?
					handler
					: [arg, handler]
				// value handler called...
				;(handler.env 
						|| 'default' in handler)
					&& values.add(handler)
				seen.add(handler)

				var res = runHandler(handler, arg, rest)

				// handle stop conditions...
				if(res === module.STOP || res === module.ERROR){
					return nested ?
						res
						: parsed }
				// finish arg processing now...
				if(res === module.THEN){
					arg = null
					break }
				continue }
			// unhandled...
			arg 
				&& unhandled.push(arg) }
		// call value handlers with .env or .default values that were 
		// not explicitly called yet...
		parsed.optionsWithValue()
			.forEach(function([k, a, d, handler]){
				values.has(handler)	
					|| (((typeof(process) != 'undefined' 
								&& handler.env in process.env) 
							|| handler.default)
						&& seen.add(handler)
						&& runHandler(handler, a || k[0], rest)) })

		// check required options...
		var missing = parsed
			.requiredOptions()
				.filter(function([k, a, d, h]){
					return !seen.has(h) })
				.map(function([k, a, d, h]){
					return k.pop() })
		if(missing.length > 0){
			handleError('required', missing, rest)
			parsed.printError('Required but missing:', missing.join(', '))
			return parsed }

		// post handlers...
		root_value = root_value && parsed.handleArgumentValue ?
			parsed.handleArgumentValue(parsed, root_value)
			: root_value
		parsed.then(unhandled, root_value, rest) 
		// XXX should we detach parsed from this???
		// 		i.e. set: 
		// 			parsed.__proto__ = {}.__proto__
		return parsed },

	// NOTE: see general doc...
	__init__: function(spec){
		Object.assign(this, spec) },
})




/**********************************************************************
* vim:set ts=4 sw=4 nowrap :                        */ return module })
