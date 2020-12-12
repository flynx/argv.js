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
* TODO:
* 	- chaining processors
* 		- handle only some args and pass the rest to the next parser...
* 		- need a unified way to handle docs..
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var path = require('path')
var object = require('ig-object')



//---------------------------------------------------------------------

var ELECTRON_PACKAGED = 
		(process.mainModule || {filename: ''})
			.filename.includes('app.asar')
		|| process.argv
			.filter(function(e){ 
				return e.includes('app.asar') })
			.length > 0


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

// NOTE: it would be great to make .message a prop and handle '$ARG' 
// 		replacement but JS uses it internally in a non standard way 
// 		so the prop is circumvented internally... (XXX)
// 		...currently the substitution is done in .printError(..)
module.ParserError = 
	object.Constructor('ParserError', Error, {
		// NOTE: I do not get why JavaScript's Error implements this 
		// 		statically...
		get name(){
			return this.constructor.name }, 

		// NOTE: msg is handled by Error(..)
		__init__: function(msg, arg, rest){
			this.arg = arg
			this.rest = rest
		},
	})

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
module.doc = object.doc
module.text = object.text


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
//	Bind a callback...
//	func(callback)
//		-> this
//
//	Trigger callbacks...
//	func(..)
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


var getFromPackage = 
module.extra.getFromPackage =
function(attr, func){
	return function(p){
		try {
			var res = require(p
				|| (typeof(this.packageJson) == 'function' ?
					this.packageJson()
					: this.packageJson)
				|| path.dirname(
						(require.main || {}).filename || '.')
				   	+'/package.json')[attr]
			return func ?
				func.call(this, res)
				: res
		} catch(err){
			return undefined } } }



//---------------------------------------------------------------------
// Presets...

/*/ XXX
var presets =
module.presets = {
	bool: {
		type: 'bool',
		value: true, 
		default: true, },
}
//*/



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
//	parser(..) 
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
// XXX PROBLEM: setting option value can overload and break existing API, 
// 		and break parsing, for example:
// 			@options: {},
// 		shadow .options(..) and break parsing...
// 		...not sure how to handle this...
// 			- isolate parsed from parser
// 			- isolate option data from parser
// 			- ...
// XXX should -help work for any command? ..not just nested parsers?
// 		...should we indicate which thinks have more "-help"??
// XXX test this...
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
		bool: function(v){ 
			return v == 'true' ? 
					true
				: v == 'false' ?
					false
				: !!v },
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

	// XXX this does not merge the parse results... (???)
	// 		...not sure how to do this yet...
	// XXX splitting the high priority args should not work...
	// XXX object.deepKeys(..) ???
	// XXX EXPERIMENTAL...
	chain: function(...parsers){
		var Parser = this
		var [post, ...pre] = parsers.reverse()
		pre.reverse()

		// only update values that were not explicitly set...
		var update = function(e, o){
			return Object.assign(
				e, 
				Object.fromEntries(
					Object.entries(o)
						.map(function([k, v]){
							return [k, 
								e.hasOwnProperty(k) ?
									e[k]
									: v ] }) )) }

		// prepare the final parser for merged doc...
		// NOTE: pre values have priority over post values...
		var final = Parser(Object.assign({
				// XXX can we remove this restriction???
				splitOptions: false,
			}, 
			// set attribute order...
			// NOTE: this is here to set the attribute order according 
			// 		to priority...
			...pre, 
			// set the correct values...
			post, 
			...pre))

		// build the chain...
		pre = pre
			// setup the chain for arg pass-through...
			.map(function(e){
				return Parser(Object.assign({}, 
					update(e, {
						splitOptions: false,
						'-help': undefined,
						'-*': undefined,
						'@*': undefined,
						'-': undefined,
					}))) }) 
		// chain...
		pre
			.reduce(function(res, cur){
				return res ?
					// NOTE: need to call .then(..) on each of the parsers, 
					// 		so we return cur to be next...
					(res.then(cur), cur)
					: cur }, null)
   			.then(final) 

		return pre[0] },

}, {
	// config...
	//
	// NOTE: this must contain two groups the first is the prefix and the 
	// 		second must contain the option name...
	// NOTE: we only care about differentiating an option from a command
	// 		here by design...
	optionInputPattern: /^([+-])\1?([^+-].*|)$/,
	commandInputPattern: /^([^-].*)$/,

	splitOptions: true,

	requiredOptionPriority: 80,

	packageJson: undefined, 

	hideExt: /\.exe$/,


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
		var attrs = object.deepKeys(that, Parser.prototype)
		return prefix
			.map(function(prefix){
				var handlers = {}
				attrs
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
	optionsWithValue: function(selector='optoins'){
		return this[selector]()
			.filter(function([k, a, d, handler]){
				return !!handler.env 
					|| 'default' in handler }) },
	requiredOptions: function(selector='optoins'){
		return this[selector]()
			.filter(function([k, a, d, handler]){
				return handler.required }) },

	commands: function(){
		return this.options(COMMAND_PREFIX) },
	commandsWithValue: function(){
		return this.optionsWithValue('commands') },
	requiredCommands: function(){
		return this.requiredOptions('commands') },

	// XXX might be a good idea to make this the base and derive the rest from here...
	// XXX a better name???
	allArguments: function(){
		return this.options(OPTION_PREFIX, COMMAND_PREFIX) },
	argumentsWithValue: function(){
		return this.optionsWithValue('allArguments') },
	requiredArguments: function(){
		return this.requiredOptions('allArguments') },

	// Get pattern arguments...
	//
	//	.patternArguments()
	//		-> list
	//
	//	Get list of pattern args that key matches...
	//	.patternArguments(key)
	//		-> list
	//
	// NOTE: list is sorted by option length...
	// NOTE: pattern->pattern aliases are not currently supported...
	// NOTE: output is of the same format as .options(..)
	// NOTE: when changing this revise a corresponding section in .handler(..)
	patternArguments: function(key){
		return this.allArguments()
			.filter(function([[opt]]){
				return opt.includes('*') 
					&& (key == null 
						|| (new RegExp(`^${ opt.split('*').join('.*') }$`)).test(key)) })
			// sort longest first...
		   	.sort(function(a, b){
				return b[0][0].length - a[0][0].length }) },

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
		// check pattern options...
		// NOTE: we are not using .patternArguments(..) because .options(..) 
		// 		used there uses .handler(..) and this breaks things...
		if(!(key in this) && key != '-*'){
			key = object.deepKeys(this, Parser.prototype)
					.filter(function(opt){
						return opt.includes('*') 
							&& (key == null 
								|| (new RegExp(`^${ opt.split('*').join('.*') }$`))
									.test(key)) })
					.sort(function(a, b){
						return b[0][0].length - a[0][0].length })[0] 
				|| key }
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
	handle: function(handler, rest, key, value, mode){
		var orig_key = key
		// got flag as handler...
		;[key, handler] = 
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
				orig_key,
				...(value != null ? 
					[value] 
					: [])) 
		// special-case: nested parser -> set results object to .<arg>...
		// XXX should we use key or orig_key here???
		if(handler instanceof Parser){
			res.unhandled
				&& this.unhandled.splice(this.unhandled.length, 0, ...res.unhandled)
			this.setHandlerValue(handler, key, res) }
		return res },

	// common tests...
	isCommand: function(str){
		return (str == '' 
				|| this.commandInputPattern.test(str))
			&& ((COMMAND_PREFIX + str) in this 
				|| !!this['@*']) },
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
	author: getFromPackage('author', 
		function(o){
			return typeof(o) != typeof('str') ?
				Object.values(o).join(' ')
				: o }),
	license: getFromPackage('license'),
	usage: '$SCRIPTNAME $REQUIRED [OPTIONS]',
	doc: undefined,
	examples: undefined,
	//footer: undefined,
	footer: 'Written by: $AUTHOR\nVersion: $VERSION / License: $LICENSE',

	// NOTE: this supports but does not requires the 'colors' module...
	// XXX should wrap long lines...
	alignColumns: function(a, b, ...rest){
		var opts_width = this.helpColumnOffset || 4
		var prefix = this.helpColumnPrefix || ''
		b = [b, ...rest].join('\n'+ ('\t'.repeat(opts_width+1) + ' '.repeat(prefix.length)))
		return b ?
			((a.strip || a).length < opts_width*8 ?
				[a +'\t'.repeat(opts_width - Math.floor((a.strip || a).length/8))+ prefix + b]
				: [a, '\t'.repeat(opts_width)+ prefix + b])
			: [a] },
	// NOTE: if var value is not defined here we'll try and get it from 
	// 		parent...
	// NOTE: this tries to be smart with spaces around $REQUIRED so 
	// 		as to keep it natural in the format string while removing 
	// 		the extra space when no value is present...
	// 			'script $REQUIRED args'
	// 		can produce:
	// 			'script args'
	// 			'script x=VALUE args'
	// 		depending on required options...
	expandTextVars: function(text){
		var that = this
		var get = function(o, attr, dfl){
			return (typeof(o[attr]) == 'function' ?
					o[attr]()
					: o[attr])
				|| (o.parent ? 
					get(o.parent, attr, dfl)
	   				: dfl )}
		// NOTE: this can get a bit expensive so we check if we need the 
		// 		value before generating it...
		text = /\$REQUIRED/g.test(text) ?
			// add required args and values...
			text
				.replace(/ ?\$REQUIRED ?/g, 
					that.requiredArguments()
						.map(function([[key], arg]){
							key = key.startsWith(COMMAND_PREFIX) ?
								key.slice(COMMAND_PREFIX.length)
								: key
							return ' '
								+(arg ?
									key+'='+arg
									: key) })
						.join('')
					+' ')
			: text
		return text
			.replace(/\$AUTHOR/g, get(that, 'author', 'Author'))
			.replace(/\$LICENSE/g, get(that, 'license', '-'))
			.replace(/\$VERSION/g, get(that, 'version', '0.0.0'))
			.replace(/\$SCRIPTNAME/g, this.scriptName || 'SCRIPT') },

	// NOTE: this will set .quiet to false...
	'-h': '-help',
	'-help': {
		doc: 'print this message and exit',
		priority: 90,
		handler: function(argv, key, value){
			var that = this
			var sep = this.helpArgumentSeparator || ', '
			var short = this.helpShortOptionSize || 1
			var expandVars = this.expandTextVars.bind(this)
			var formDoc = function(doc, handler, arg){
				var dfl = getValue(handler, 'default')[1]
				var req = getValue(handler, 'required')[1]
				var val_req = getValue(handler, 'valueRequired')[1]
				var env = getValue(handler, 'env')[1]

				doc = (doc instanceof Array ?
						doc
						: [doc])
					.map(function(s){
						return s.replace(/\\\*/g, '*') })
				var info = [
					...(req ?
						['required']
						: []),
					...(val_req ?
						['required value']
						: []),
					...(dfl ?
						[`default: ${ JSON.stringify(dfl) }`]
						: []),
					...(env ?
						[`env: \$${ env }`]
						: []),
					...(handler instanceof Parser ?
						//[`more: ${ that.scriptName } ${ arg.slice(1) } -h`]
						[`more: .. ${ arg.slice(1) } -h`]
						: []),
				].join(', ')

				return [
					...doc,
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
						src[name].call(that)
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
					// 		....or: 'Group title': 'section', items that
					// 		print as section titles...
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
									...formDoc(doc, handler, opts.slice(-1)[0]) ] })),
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
									...formDoc(doc, handler, cmd.slice(-1)[0]) ] })),
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
	//version: undefined,
	version: getFromPackage('version'),

	'-v': '-version',
	'-version': {
		doc: 'show $SCRIPTNAME version and exit',
		priority: 80,
		handler: function(){
			this.quiet = false
			this.print((typeof(this.version) == 'function' ?
					this.version()
					: this.version)
				|| '0.0.0')
			return module.STOP }, },


	// Quiet mode...
	// 
	quiet: undefined,

	'-q': '-quiet',
	'-quiet': {
		priority: 70,
		doc: 'quiet mode', 
		default: true, },


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
			throw module.ParserError(
				`Unknown ${key.startsWith('-') ? 'option:' : 'command:'} $ARG`) } },
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
	// NOTE: this handles $ARG in error.message.
	printError: afterCallback('print_error', null, function(...args){
		if(args[0] instanceof module.ParserError){
			var err = args[0]
			console.error(
				this.scriptName+':', 
				err.name+':', 
				err.message
					// XXX this should be done in ParserError but there 
					// 		we have to fight Error's implementation of 
					// 		.message and its use...
					.replace(/\$ARG/, err.arg), 
				...args.slice(1))
			return err }
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
		value = this.handleArgumentValue ?
			this.handleArgumentValue(handler, value)
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
			&& process.exit(1) 
		return this },


	// Pre-parsing callbacks...
	//
	//	.onArgs(callback(args))
	//
	//	.onNoArgs(callback(args))
	//
	//
	// NOTE: args is mutable and thus can be modified here affecting 
	// 		further parsing.
	//
	// XXX need a way to stop processing in the same way 'return THEN' / 'return STOP' do...
	// 		...one way to do this currently is to empty the args...
	onArgs: afterCallback('onArgs'),
	onNoArgs: afterCallback('onNoArgs'),

	// Post-parsing callbacks...
	//
	// 	XXX this should be able to accept a parser...
	// 		...i.e. the callback must be signature-compatible with .__call__(..)
	// 	.then(callback(unhandled, root_value, rest))
	//
	// 	.stop(callback(arg, rest))
	// 	.error(callback(reason, arg, rest))
	//
	then: afterCallback('parsing'),
	stop: afterCallback('stop'),
	error: afterCallback('error'),

	//
	// XXX another way to do this is to make .then(..) signature-compatible 
	// 		with the parser.__call__(..) and pass it a parser...
	// 		...this would require -help to be able to document the 
	// 		chained parser(s)...
	// 		...also, being able to quit from the handler preventing further 
	// 		handling (a-la returning STOP)
	// XXX need:
	// 		- a way for the next parser to bail or explicitly call next 
	// 			chained -- can be done in .onArgs(..)...
	// 			...do we need a .next(..) method???
	// XXX EXPERIMENTAL, not yet used...
	//chain: afterCallback('chain'),

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
		var that = this
		var parsed = Object.create(this)
		var nested = parsed.parent = false
		var opt_pattern = parsed.optionInputPattern

		// prep argv...
		var rest = parsed.rest = 
			argv == null ?
				(typeof(process) != 'undefined' ?
					process.argv 
					: [])
				: argv
		parsed.argv = rest.slice() 

		// nested handler...
		if(context instanceof Parser){
			nested = parsed.parent = context
			main = context.scriptName +' '+ main 
			rest.unshift(main)

		// electron packaged app root -- no script included...
		} else if(ELECTRON_PACKAGED){
			main = main || rest[0]
			main = (parsed.hideExt && parsed.hideExt.test(rest[0])) ? 
				// remove ext...
				main.replace(parsed.hideExt, '')
				: main 
			rest.splice(0, 1, main) 

		// node...
		} else {
			main = main || rest[1] 
			rest.splice(0, 2, main) }

		// script stuff...
		var script = parsed.script = rest.shift()
		var basename = script.split(/[\\\/]/).pop() 
		parsed.scriptName = parsed.scriptName || basename
		parsed.scriptPath = script.slice(0, 
			script.length - parsed.scriptName.length)

		// call the pre-parse handlers...
		// NOTE: these can modify the mutable rest if needed...
		rest.length == 0 ?
			this.onNoArgs(rest)
			: this.onArgs(rest)

		// helpers...
		// XXX should this pass the error as-is to the API???
		var handleError = function(reason, arg, rest){
			arg = arg || reason.arg
			rest = rest || reason.rest
			reason = reason instanceof Error ?
				[reason.name, reason.message].join(': ')
				: reason
			parsed.error(reason, arg, rest)
			parsed.handleErrorExit
				&& parsed.handleErrorExit(arg, reason) }
		var runHandler = function(handler, arg, rest, mode){
			var [arg, value] = arg instanceof Array ?
				arg
				: arg.split(/=/)
			var env = handler.env 
				&& handler.env.replace(/^\$/, '')
			// get value...
			value = value == null ?
				((parsed.hasArgument(handler) 
								&& rest.length > 0
								&& !opt_pattern.test(rest[0])) ?
							rest.shift()
						: (typeof(process) != 'undefined' 
								&& env
								&& env in process.env) ?
							process.env[env]
						: value)
				: value
			value = value == null ?
				typeof(handler.default) == 'function' ?
					handler.default.call(that)
					: handler.default
				: value
			// value conversion...
			value = (value != null 
					&& parsed.handleArgumentValue) ?
				parsed.handleArgumentValue(handler, value)
				: value

			try {
				// required value check...
				if(handler.valueRequired && value == null){
					throw module.ParserValueError('Value missing: $ARG=?') }

				// do not call the handler if value is implicitly undefined...
				if(value === undefined
						&& mode == 'implicit'){
					return }
			
				var res = parsed.handle(handler, rest, arg, value)

			// update error object with current context's arg and rest...
			} catch(err){
				if(err instanceof module.ParserError){
					err.arg = err.arg || arg
					err.rest = err.rest || rest }
				throw err }

			// NOTE: we also need to handle the errors passed to us from 
			// 		nested parsers...
			res === module.STOP
				&& parsed.stop(arg, rest)
			// handle passive/returned errors...
			res instanceof module.ParserError
				&& handleError(res, arg, rest)
			return res }
		// NOTE: if successful this needs to modify the arg, thus it 
		// 		returns both the new first arg and the handler...
		// NOTE: if the first letter is a fail the whole arg will get 
		// 		reported...
		// XXX do we need to report the specific fail or the whole 
		// 		unsplit arg??? (see below)
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
			var h = parsed.handler(a)[1]
			// XXX do we need to report the specific fail or the whole 
			// 		unsplit arg???
			// check the rest of the args...
			//if(h && r.reduce(function(r, a){ 
			//		return r && parsed.handler(a)[1] }, true)){
			if(h){
				// push new options back to option "stack"...
				rest.splice(0, 0, ...r)
				return [ a, h ] }
			// no handler found -> return undefined
			return [ arg, undefined ] }

		try{
			// parse/interpret the arguments and call handlers...
			var values = new Map(
				parsed.argumentsWithValue()
					.map(function([k, a, d, handler]){ 
						return [handler, k[0]] }))
			var seen = new Set()
			var unhandled = parsed.unhandled = []
			while(rest.length > 0 || (values.size || values.length) > 0){
				// explicitly passed options...
				if(rest.length > 0){
					var mode = 'explicit'
					var arg = rest.shift()
					// non-string stuff in arg list...
					if(typeof(arg) != typeof('str')){
						unhandled.push(arg) 
						continue }
					// quote '-*' / '@*'...
					arg = arg.replace(/^(.)\*$/, '$1\\*')
					var [type, dfl] = opt_pattern.test(arg) ?
							['opt', OPTION_PREFIX +'*']
						: parsed.isCommand(arg) ?
							['cmd', COMMAND_PREFIX +'*']
						: ['unhandled']
					// no handler is found...
					if(type == 'unhandled'){
						unhandled.push(arg)
						continue }

					// get handler...
					// NOTE: opts and commands do not follow the same path here 
					// 		because options if unidentified need to be split into
					// 		single letter options and commands to not...
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
						unhandled.push(arg)
						continue }

					// mark/unmark handlers...
					values.delete(handler)
					seen.add(handler)

				// implicit options -- with .env and or .default set...
				} else {
					var mode = 'implicit'
					values = values instanceof Map ?
						[...values]
						: values
					var [handler, arg] = values.shift() }


				var res = runHandler(handler, arg, rest, mode)

				// handle stop conditions...
				if(res === module.STOP 
						|| res instanceof module.ParserError){
					return nested ?
						res
						: parsed }
				// finish arg processing now...
				if(res === module.THEN){
					break } }

			// check and report required options...
			var missing = parsed
				.requiredArguments()
					.filter(function([k, a, d, h]){
						return !seen.has(h) })
					.map(function([k, a, d, h]){
						return k.pop() })
			if(missing.length > 0){
				throw module.ParserError(`required but missing: $ARG`, missing.join(', ')) }

		// handle ParserError...
		} catch(err){
			// re-throw the error...
			if(!(err instanceof module.ParserError)){
				throw err } 
			// report local errors...
			// NOTE: non-local errors are threaded as return values...
			parsed.printError(err) 
			handleError(err, err.arg, rest)
			return nested ?
				err
				: parsed }

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
