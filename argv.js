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
// setup...

var OPTION_PREFIX = '-'
var COMMAND_PREFIX = '@'



//---------------------------------------------------------------------

module.STOP = 
	{doc: 'Stop option processing, triggers .stop(..) handlers'}

module.THEN = 
	{doc: 'Break option processing, triggers .then(..) handlers'}


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

module.ParserError = 
	object.Constructor('ParserError', Error, {
		// NOTE: I do not get why JavaScript's Error implements this 
		// 		statically...
		get name(){
			return this.constructor.name }, })

module.ParserTypeError = 
	object.Constructor('ParserTypeError', module.ParserError, {})
module.ParserValueError = 
	object.Constructor('ParserValueError', module.ParserError, {})



//---------------------------------------------------------------------
// Helpers...

// These can be useful in the argv parsing context...
//
module.normalizeIndent = object.normalizeIndent
module.normalizeTextIndent = object.normalizeTextIndent


// container for secondary/extra stuff...
//
module.extra = {}


// function with callback generator...
//
//	afterCallback(name)
//		-> func
//
//	afterCallback(name, pre_action, post_action)
//		-> func
//
//
//	func(..)
//		-> this
//		-> res 
//
//	pre_action(...args)
//		-> false
//		-> ...
//
//	post_action(...args)
//		-> ...
//
//
var afterCallback = 
module.extra.afterCallback =
function(name, pre, post){
	var attr = '__after_'+ name
	return function(...args){
		var that = this
		// bind...
		if(args.length == 1 && typeof(args[0]) == 'function'){
			(this[attr] = this[attr] || []).push(args[0])
			return this }
		// pre callback...
		var call = pre ?
			(pre.call(this, ...args) !== false)
			: true
		return ((call && this[attr] || [])
				// call handlers...
				.map(function(func){
					return func.call(that, ...args) })
				// stop if module.STOP is returned and return this...
				.includes(false) && this)
			// post callback...
			|| (post ?
				post.call(this, ...args)
				: this) } }



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
//			arg: 'VALUE|key',
//
//			type: 'int',
//
//			collect: 'string|, ',
//
//			env: 'VALUE',
//
//			default: 123,
//
//			priority: 50,
//
//			required: false,
//
//			valueRequired: false,
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
// NOTE: currently any "argument" that passes the .optionInputPattern test
// 		is handled as an option, no matter what the prefix, so different 
// 		prefixes can be handled by the handler by checking the key argument.
// 		currently both '-' and '+' are supported.
// NOTE: essentially this parser is a very basic stack language...
//
// XXX revise PareserError handling:
// 		- throws should get reported
// 		- returns should be silent
// 		update code accordingly...
//
// XXX should -help work for any command? ..not just nested parsers?
// 		...should we indicate which thinks have more "-help"??
var Parser =
module.Parser =
object.Constructor('Parser', {
	//
	// 	handler(value, ...options)
	// 		-> value
	//
	// NOTE: options are passed to the definition in the option handler, 
	// 		i.e. the list of values separated by '|' after the type 
	// 		definition.
	typeHandlers: {
		string: function(v){ return v.toString() },
		bool: function(v){ return !!v },
		int: parseInt,
		float: parseFloat,	
		number: function(v){ return new Number(v) },
		date: function(v){ return new Date(v) },
		list: function(v){ 
			return v
				.split(',')
				.map(function(e){ return e.trim() }) },
	},

	// 
	// 	handler(value, stored_value, key, ...options)
	// 		-> stored_value
	//
	// For more info see docs for .typeHandlers
	valueCollectors: {
		// format: 'string' | 'string|<separator>'
		string: function(v, cur, _, sep){ 
			return [...(cur ? [cur] : []), v]
				.join(sep || '') },
		list: function(v, cur){ return (cur || []).concat(v) },
		set: function(v, cur){ return (cur || new Set()).add(v) },
		// NOTE: this will ignore the actual value given...
		toggle: function(v, cur){ return !cur },
	},

}, {
	// config...
	//
	// NOTE: this must contain two goups the first is the prefix and the 
	// 		second must contain the option name...
	// NOTE: we only care about differentiating an option from a command
	// 		here by design...
	optionInputPattern: /^([+-])\1?([^+-].*|)$/,
	commandInputPattern: /^([^-].*)$/,

	splitOptions: true,

	requiredOptionPriority: 80,


	// instance stuff...
	// XXX do we need all three???
	script: null,
	scriptNmae: null,
	scriptPath: null,

	argv: null,
	rest: null,
	unhandled: null,
	value: null,


	// Handler iterators...
	//
	// Format:
	// 	[
	// 		[<keys>, <arg>, <doc>, <handler>],
	// 		...
	// 	]
	//
	options: function(...prefix){
		var that = this
		var req_prio = this.requiredOptionPriority != null ? 
			this.requiredOptionPriority
			: 80
		prefix = prefix.length == 0 ?
			[OPTION_PREFIX]
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
								: (handlers[k] = [
									[opt], 
									that.hasArgument(h)
										&& h.arg
											.split(/\|/)
											.shift()
											.trim(), 
									h.doc == null ?
										k.slice(1)
										: h.doc, 
									h ])) })
				return Object.values(handlers) })
			.flat(1) 
			.map(function(e, i){ return [e, i] })
			.sort(function([a, ai], [b, bi]){
				a = a[3].priority !== undefined ?
					a[3].priority 
					: (a[3].required && req_prio)
				b = b[3].priority !== undefined ?
					b[3].priority 
					: (b[3].required && req_prio)
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
		return this.options(COMMAND_PREFIX) },

	// Get handler...
	//
	// 	.handler(key)
	// 		-> [key, handler, ...error_reason]
	//
	// NOTE: this ignores any arguments values present in the key...
	// NOTE: this ignores options forming alias loops and dead-end 
	// 		options...
	handler: function(key){
		// clear arg value...
		key = key.split(/=/).shift()
		// normalize option/command name...
		key = this.optionInputPattern.test(key) ?
				key.replace(this.optionInputPattern, OPTION_PREFIX+'$2')
			: !key.startsWith(COMMAND_PREFIX) ?
				key.replace(this.commandInputPattern, COMMAND_PREFIX+'$1')
			: key
		var seen = new Set()
		while(key in this 
				&& typeof(this[key]) == typeof('str')){
			key = this[key] 
			// check for loops...
			if(seen.has(key)){
				return [key, undefined,
					// report loop...
					'loop', [...seen, key]] }
			seen.add(key) }
		return [key, this[key],
			// report dead-end if this[key] is undefined...
			...(this[key] ? 
				[]
				: ['dead-end'])] },

	// Trigger the handler...
	// 
	// 	Get the handler for key and call it...
	// 	.handle(key, rest, _, value)
	// 		-> res
	//
	// 	Call handler...
	// 	.handle(handler, rest, key, value)
	// 		-> res
	//
	//
	// NOTE: this has the same signature as a normal handler with a leading 
	// 		handler/flag argument.
	// NOTE: this is designed for calling from within the handler to 
	// 		delegate option processing to a different option.
	// 		(see '-?' for a usage example)
	// NOTE: this will not handle anything outside of handler call
	handle: function(handler, rest, key, value){
		// got flag as handler...
		[key, handler] = 
			typeof(handler) == typeof('str') ?
				this.handler(handler)
			: [key, handler]
		// run handler...
		var res = (typeof(handler) == 'function' ?
				handler
				: (handler.handler 
					|| function(...args){
						return this.handlerDefault(handler, ...args) }))
			.call(this, 
				rest, 
				key,
				...(value != null ? 
					[value] 
					: [])) 
		// special-case: nested parser -> set results object to .<arg>...
		if(handler instanceof Parser){
			res.unhandled
				&& this.unhandled.splice(this.unhandled.length, 0, ...res.unhandled)
			this.setHandlerValue(handler, key, res) }
		return res },

	// common tests...
	isCommand: function(str){
		return this.commandInputPattern.test(str) 
			&& ((COMMAND_PREFIX + str) in this 
				|| this['@*']) },
	hasArgument: function(handler){
		handler = typeof(handler) == typeof('str') ?
			this.handler(handler)[1]
			: handler
		return handler 
			&& handler.arg 
			&& handler.arg.split(/\|/)[0].trim() != '' },


	// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
	// Builtin options/commands and their configuration...
	
	// Help...
	//
	// Formatting option spec:
	//
	//                       +-------------- .helpColumnOffset (3 tabs)
	//                      /
	//      |<------+-------+------>|
	//   
	//      -o,  --option=VALUE     - option doc
	//        __        _           __
	//       _  \        \            \
	//        \  \        \            +---- .helpColumnPrefix ('- ')
	//         \  \        \
	//          \  \        +--------------- .helpValueSeparator ('=')
	//           \  \
	//            \  +---------------------- .helpArgumentSeparator (', ')
	//             \
	//              +----------------------- .helpShortOptionSize (2 chars)
	//
	//
	// NOTE: no effort was made to handle ALL cases gracefully, but in 
	// 		the most common cases this should work quite fine.
	// 		common cases:
	// 			- 1-2 flag variants (short/long) per flag
	// 			- short-ish flag descriptions
	helpColumnOffset: 3,
	helpShortOptionSize: 2,
	helpColumnPrefix: '- ',
	helpArgumentSeparator: ', ',
	helpValueSeparator: '=',

	// doc sections...
	author: undefined,
	license: undefined,
	usage: '$SCRIPTNAME [OPTIONS]',
	doc: undefined,
	examples: undefined,
	//footer: 'Written by $AUTHOR ($VERSION / $LICENSE).',
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

	// NOTE: this will set .quiet to false...
	'-h': '-help',
	'-help': {
		doc: 'print this message and exit',
		priority: 99,
		handler: function(argv, key, value){
			var that = this
			var sep = this.helpArgumentSeparator || ', '
			var short = this.helpShortOptionSize || 1
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
				return [doc.replace(/\\\*/g, '*'),
					...(info.length > 0 ?
						['('+ info +')']
						: [])] }
			var getValue = function(src, name){
				name = arguments.length == 1 ?
					src
					: name
				src = arguments.length == 1 ? 
					that 
					: src
				return src[name] ?
					['', typeof(src[name]) == 'function' ?
						src[name]()
						: src[name]]
		   			: [] }
			var section = function(title, items){
				items = items instanceof Array ? items : [items]
				return items.length > 0 ?
					['', title +':', ...items]
					: [] }

			// ignore quiet mode...
			this.quiet = false

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
								opts = handler.key || opts
								opts = opts instanceof Array ? opts : [opts]
								return [ 
									[opts
										// unquote...
										.map(function(o){
											return o.replace(/\\\*/g, '*') })
										.sort(function(a, b){ 
											return a.length - b.length})
										// form: "-x, --xx"
										.map(function(o, i, l){
											return o.length <= 1 + short ? 
													o 
												// no short options -> offset first long option...
												: i == 0 ?
													' '.repeat(1 + short + sep.length) +'-'+ o
												// short option shorter than 1 + short 
												// 		-> offset first long option by difference...
												: i == 1 ?
													' '.repeat(1 + short - l[0].length || 0) +'-'+ o
												// add extra '-' to long options...
												: o.length > short ?
													'-'+ o 
												: o })
										.join(sep),
										...(arg ? 
											[arg] 
											: [])]
										.join(that.helpValueSeparator), 
									...formDoc(doc, handler) ] })),
					// dynamic options...
					...section('Dynamic options',
						(this['-*'] && this['-*'].section_doc) ? 
							getValue(this['-*'], 'section_doc') || [] 
							: []),
					// commands (optional)...
					...section('Commands',
						this.commands()
							.filter(function([o, a, doc]){
								return doc !== false })
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
					// dynamic commands...
					...section('Dynamic commands',
						(this['@*'] && this['@*'].section_doc) ? 
							getValue(this['@*'], 'section_doc') || [] 
							: []),
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
	// alias for convenience (not documented)...
	'-?': {
		doc: false,
		handler: function(){
			return this.handle('-help', ...arguments) } },


	// Version...
	//
	// NOTE: this will set .quiet to false...
	version: undefined,

	'-v': '-version',
	'-version': {
		doc: 'show $SCRIPTNAME verion and exit',
		priority: 99,
		handler: function(){
			this.quiet = false
			this.print(this.version || '0.0.0')
			return module.STOP }, },


	// Quiet mode...
	// 
	quiet: undefined,

	'-q': '-quiet',
	'-quiet': {
		priority: 99,
		doc: 'quiet mode', },


	// Stop argument processing...
	//
	// This will trigger .then(..) handlers...
	//
	// If .then(..) does not handle rest in the nested context then this
	// context will be returned to the parent context, effectively 
	// stopping the nested context and letting the parent continue.
	//
	// NOTE: to stop the parent parser push '-' to rest's head...
	'-': {
		doc: 'stop processing arguments after this point',
		handler: function(){
			return module.THEN }, },


	// Dynamic handlers...
	//
	// These can be presented in help in two sections:
	// 	Options / Commands
	// 		.doc is a string
	// 		.key can be used to override the option text
	//
	// 	Dynamic options / Dynamic commands
	// 		.section_doc is a string or array
	//
	// NOTE: to explicitly handle '-*' option or '*' command define handlers
	// 		for them under '-\\*' and '@\\*' respectively.
	'-*': {
		doc: false,
		//section_doc: ...,
		handler: function(_, key){
			return this.printError(
				module.ParserError(
					`Unknown ${key.startsWith('-') ? 'option:' : 'command:'} ${ key }`)) } },
	'@*': '-*',
	

	// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

	// Output...
	//
	print: afterCallback('print', null, function(...args){
		this.quiet
			|| console.log(...args)
		return this }),
	//
	// 	.printError(...)
	// 		-> this
	//
	// 	.printError(error, ...)
	// 		-> error
	//
	printError: afterCallback('print_error', null, function(...args){
		if(args[0] instanceof module.ParserError){
			console.error(
				this.scriptName+':', args[0].name+':', args[0].message, ...args.slice(1))
			return args[0] }
		console.error(this.scriptName+': Error:', ...args)
		return this }),


	// Handle value via this/parent value handlers... (helper)
	//
	// Expected attr format:
	//
	// 	option_handler[attr] = '<handler-name>' | '<handler-name>|<arg>|...'
	//
	//
	// This will call the handler in this context with the following 
	// signature:
	//
	// 	handler(value, ...args, ...sargs)
	//
	// Where sargs is the list of arguments defined in attr via '|'.
	//
	// For an example see: .handleArgumentValue(..) and .setHandlerValue(..)
	_handleValue: function(handler, attr, handlers, value, ...args){
		var [h, ...sargs] = 
			typeof(handler[attr]) == typeof('str') ?
				handler[attr].split(/\|/)
				: []
		var func = 
			typeof(handler[attr]) == 'function' ?
				handler[attr]
				: (this[handlers] 
					|| this.constructor[handlers]
					|| {})[h]
		return func ?
			func.call(this, value, ...args, ...sargs)
			: value },

	// Set handler value... (helper)
	//
	// This handles handler.arg and basic name generation...
	setHandlerValue: function(handler, key, value){
		handler = handler 
			|| this.handler(key)[1] 
			|| {}
		var attr = (handler.arg
				&& handler.arg
					.split(/\|/)
					.pop()
					.trim())
			// get the final key...
			|| this.handler(key)[0].slice(1)
		// if value not given set true and handle...
		//this[key] = arguments.length < 3 ?
		value = arguments.length < 3 ?
			(this.handleArgumentValue ?
				this.handleArgumentValue(handler, true)
				: true)
			: value

		this[attr] = this._handleValue(handler, 
			'collect', 'valueCollectors', 
			value, this[attr], key)

		return this },


	// Default handler action...
	//
	// This is called when .handler is not set...
	handlerDefault: function(handler, rest, key, value){
		return this.setHandlerValue(handler, ...[...arguments].slice(2)) },

	// Handle argument value conversion...
	//
	// If this is false/undefined value is passed to the handler as-is...
	//
	// NOTE: to disable this functionality just set:
	//			handleArgumentValue: false
	handleArgumentValue: function(handler, value){
		return this._handleValue(handler, 'type', 'typeHandlers', value) },

	// Handle error exit...
	//
	// If this is set to false Parser will not call process.exit(..) on 
	// error...
	handleErrorExit: function(arg, reason){
		typeof(process) != 'unhandled'
			&& process.exit(1) },


	// Post parsing callbacks...
	//
	// 	.then(callback(unhandleed, root_value, rest))
	//
	// 	.stop(callback(arg, rest))
	// 	.error(callback(reason, arg, rest))
	//
	then: afterCallback('parsing'),
	stop: afterCallback('stop'),
	error: afterCallback('error'),

	// Remove callback...
	off: function(evt, handler){
		var l = this['__after_'+evt]
		var i = l.indexOf(handler)
		i >= 0
			&& l.splice(i, 1)
		return this },


	// Handle the arguments...
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
	//
	// NOTE: the result is an object inherited from parser and containing 
	// 		all the parse data...
	// NOTE: this (i.e. parser) can be used as a nested command/option 
	// 		handler...
	__call__: function(context, argv, main, root_value){
		var parsed = Object.create(this)
		var opt_pattern = parsed.optionInputPattern
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
		var nested = parsed.nested = false
		if(context instanceof Parser){
			nested = parsed.nested = true
			main = context.scriptName +' '+ main 
			rest.unshift(main) }
		// normalize the argv...
		if(main != null){
			rest.splice(0, rest.indexOf(main))
			rest.includes(main)
				|| rest.unshift(main) }
		// script stuff...
		var script = parsed.script = rest.shift()
		var basename = script.split(/[\\\/]/).pop() 
		parsed.scriptName = parsed.scriptName || basename
		parsed.scriptPath = script.slice(0, 
			script.length - parsed.scriptName.length)

		// helpers...
		var handleError = function(reason, arg, rest){
			reason = reason instanceof Error ?
				[reason.name, reason.message].join(': ')
				: reason
			parsed.error(reason, arg, rest)
			parsed.handleErrorExit
				&& parsed.handleErrorExit(arg, reason) }
		var reportError = function(message, arg, rest){
			message = message
				.replace(/$ARG/g, arg)
			handleError(message, arg, rest)
			return parsed.printError(
				module.ParserError(message)) }
		var runHandler = function(handler, arg, rest){
			var [arg, value] = arg instanceof Array ?
				arg
				: arg.split(/=/)
			// get value...
			value = value == null ?
				(((parsed.hasArgument(handler) && !opt_pattern.test(rest[0])) ?
							rest.shift()
						: (typeof(process) != 'undefined' && handler.env) ?
							process.env[handler.env] 
						: value)
					|| handler.default)
				: value
			// value conversion...
			value = (value != null 
					&& parsed.handleArgumentValue) ?
				parsed.handleArgumentValue(handler, value)
				: value
			// required value check...
			if(handler.valueRequired && value == null){
				return reportError('Value missing: $ARG=?', arg, rest) }

			try {
				// run handler...
				var res = parsed.handle(handler, rest, arg, value)

			} catch(err){
				// re-throw the error...
				// NOTE: do not like that this can mask the location of 
				// 		the original error.
				if(!(err instanceof module.ParserError)){
					throw err } 
				// XXX should we report an error here???
				parsed.printError(err)
				res = err }

			// NOTE: we also need to handle the errors passed to us from 
			// 		nested parsers...
			res === module.STOP
				&& parsed.stop(arg, rest)
			res instanceof module.ParserError
				&& handleError(res, arg, rest)
			return res }
		// NOTE: if successful this needs to modify the arg, thus it 
		// 		returns both the new first arg and the handler...
		var splitArgs = function(arg, rest){
			var [arg, value] = arg.split(/=/)
			// skip single letter unknown or '--' options...
			if(arg.length <= 2 
					|| arg.startsWith(OPTION_PREFIX.repeat(2))){
				return [arg, undefined] }
			// split and normalize...
			var [a, ...r] = 
				[...arg.slice(1)]
					.map(function(e){ return '-'+ e })
			// push the value to the last arg...
			value !== undefined
				&& r.push(r.pop() +'='+ value) 
			// push new options back to option "stack"...
			rest.splice(0, 0, ...r)
			return [ a, parsed.handler(a)[1] ] }

		// parse/interpret the arguments and call handlers...
		var values = new Set()
		var seen = new Set()
		var unhandled = parsed.unhandled = []
		while(rest.length > 0){
			var arg = rest.shift()
			// non-string stuff in arg list...
			if(typeof(arg) != typeof('str')){
				unhandled.push(arg) 
				continue }
			// NOTE: opts and commands do not follow the same path here 
			// 		because options if unidentified need to be split into
			// 		single letter options and commands to not...
			var [type, dfl] = opt_pattern.test(arg) ?
					['opt', OPTION_PREFIX +'*']
				: parsed.isCommand(arg) ?
					['cmd', COMMAND_PREFIX +'*']
				: ['unhandled']
			// options / commands...
			if(type != 'unhandled'){
				// quote '-*' / '@*'...
				arg = arg.replace(/^(.)\*$/, '$1\\*')
				// get handler...
				var handler = parsed.handler(arg)[1]
					// handle merged options...
					|| (type == 'opt' 
						&& parsed.splitOptions
						// NOTE: we set arg here...
						&& ([arg, handler] = splitArgs(arg, rest))[1] )
					// dynamic or error...
					|| parsed.handler(dfl)[1]
				// no handler found and '-*' or '@*' not defined...
				if(handler == null){
					return reportError(`Unknown ${ type == 'opt' ? 'option' : 'command:' } $ARG`, arg, rest) }

				// mark handler...
				;(handler.env || 'default' in handler)
					&& values.add(handler)
				seen.add(handler)

				var res = runHandler(handler, arg, rest)

				// handle stop conditions...
				if(res === module.STOP 
						|| res instanceof module.ParserError){
					return nested ?
						res
						: parsed }
				// finish arg processing now...
				if(res === module.THEN){
					break }
				continue }
			// unhandled...
			unhandled.push(arg) }
		// call value handlers with .env or .default values that were 
		// not explicitly called yet...
		parsed.optionsWithValue()
			.forEach(function([k, a, d, handler]){
				values.has(handler)	
					|| (((typeof(process) != 'undefined' 
								&& handler.env in process.env) 
							|| handler.default)
						&& seen.add(handler)
						&& runHandler(handler, 
							[k[0], handler.default], 
							rest)) })

		// check and report required options...
		var missing = parsed
			.requiredOptions()
				.filter(function([k, a, d, h]){
					return !seen.has(h) })
				.map(function([k, a, d, h]){
					return k.pop() })
		if(missing.length > 0){
			reportError('required but missing: $ARG', missing.join(', '), rest)
			return parsed }

		// handle root value...
		root_value = 
			(root_value && parsed.handleArgumentValue) ?
				parsed.handleArgumentValue(parsed, root_value)
				: root_value
		root_value
			&& (parsed.value = root_value)

		parsed.then(unhandled, root_value, rest) 
		return parsed },

	// NOTE: see general doc...
	__init__: function(spec){
		Object.assign(this, spec) },
})




/**********************************************************************
* vim:set ts=4 sw=4 nowrap :                        */ return module })
