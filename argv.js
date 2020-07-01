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
//			env: 'VALUE',
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
// It is recommended not to do any processing with side-effects in 
// option/command handlers directly, prepare for the execution and to 
// the actual work in the .then(..) callback. The reason being that the 
// option handlers are called while parsing options and thus may not 
// yet know of any error or stop conditions triggered later in the argv.
//
//
// XXX add support for - or -- stdin handling... (???)
// XXX add support for outputting strings instead of console.log(..)
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


	// Handler API...
	//
	// Format:
	// 	[
	// 		[<keys>, <arg>, <doc>, <handler>],
	// 		...
	// 	]
	//
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
	envOptions: function(){
		return this.options()
			.filter(function([k, a, d, handler]){
				return !!handler.env }) },
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

	// doc stuff...
	helpColumnOffset: 3,
	helpColumnPrefix: '- ',

	// doc sections...
	// XXX
	version: undefined,
	usage: '$SCRIPTNAME [OPTIONS]',
	doc: undefined,
	examples: undefined,
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
			var formDoc = function(doc, env){
				return [doc, ...(env ? 
					[`(default value: \$${env})`] 
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

			console.log(
				expandVars([
					`Usage: ${ getValue('usage').join('') }`,
					// doc (optional)...
					...getValue('doc'),
					// options...
					// XXX add option groups...
					...section('Options',
						this.options()
							.map(function([opts, arg, doc, handler]){
								return [ 
									opts
										.sort(function(a, b){ 
											return a.length - b.length})
										.join(' | -') 
											+' '+ (arg || ''), 
									...formDoc(doc, handler.env) ] })),
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
									cmd
										.map(function(cmd){ return cmd.slice(1)})
										.join(' | ')
											+' '+ (arg || ''), 
									...formDoc(doc, handler.env) ] })),
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
	//
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
		// doc handler...
		if(arguments.length == 1 && arguments[0] == 'doc'){
			return undefined }
		console.error('Unknown '+ (key.startsWith('-') ? 'option:' : 'command:'), key)
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
	// 	.then(callback(unhandleed, root_value))
	//
	// 	.stop(callback(arg))
	//
	// 	.error(callback(arg))
	//
	then: afterCallback('parsing'),
	stop: afterCallback('stop'),
	error: afterCallback('error'),

	//
	//	parser(argv)
	//		-> parser
	//
	//	parser(argv, main)
	//		-> parser
	//
	// NOTE: this (i.e. parser) can be used as a nested command/option 
	// 		handler...
	__call__: function(context, argv, main, root_value){
		var that = this
		var nested = false
		var rest = this.rest = 
			argv == null ?
				(typeof(process) != 'unhandled' ?
					process.argv 
					: [])
				: argv
		argv = rest.slice() 
		main = main 
			|| require.main.filename

		// nested command handler...
		if(context instanceof Parser){
			nested = true
			main = context.scriptName +' '+ main 
			rest.unshift(main) }

		// normalize the argv...
		if(main != null){
			this.pre_argv = rest.splice(0, rest.indexOf(main))
			rest.includes(main)
				|| rest.unshift(main) }

		this.script = rest[0]
		this.scriptName = rest.shift().split(/[\\\/]/).pop() 
		this.scriptPath = this.script.slice(0, 
			this.script.length - this.scriptName.length)

		var opt_pattern = this.optionInputPattern

		// helpers...
		var runHandler = function(handler, arg, rest){
			var [arg, value] = arg.split(/=/)
			// get option value...
			value = value 
				|| ((handler.arg && !opt_pattern.test(rest[0])) ?
						rest.shift()
					: (typeof(process) != 'unhandled' && handler.env) ?
						process.env[handler.env]
					: undefined)
			// value conversion...
			value = (value && that.handleArgumentValue) ?
				that.handleArgumentValue(handler, value)
				: value
			// run handler...
			var res = (typeof(handler) == 'function' ?
					handler
					: handler.handler)
				.call(that, 
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
					&& this.handleErrorExit(arg) }
			return res }
		// NOTE: if successful this needs to modify the arg, thus it 
		// 		returns both the new first arg and the handler...
		var splitArgs = function(arg, rest){
			var [arg, value] = arg.split(/=/)
			// skip single letter unknown options or '--' options...
			if(arg.length <= 2 
					|| arg.startsWith(that.optionPrefix.repeat(2))){
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
			var handler = that.handler(a)[1]
			return handler 
				&& [a, handler] }

		var env = new Set()
		var unhandled = []
		while(rest.length > 0){
			var arg = rest.shift()
			var type = opt_pattern.test(arg) ?
					'opt'
				: this.isCommand(arg) ?
					'cmd'
				: 'unhandled'
			// options / commands...
			if(type != 'unhandled'){
				// get handler...
				// XXX revise -- arg replacement feels clunky...
				var handler = this.handler(arg)[1]
					// handle merged options
					// NOTE: if successful returns array...
					|| (type == 'opt' 
						&& this.splitOptions
						&& splitArgs(arg, rest))
					// dynamic or error...
					|| this.handleArgument
				// normalize output of splitArgs(..)
				;[arg, handler] = handler instanceof Array ?
					handler
					: [arg, handler]
				// env handler called...
				handler.env
					&& env.add(handler)

				var res = runHandler(handler, arg, rest)

				// handle stop conditions...
				if(res === module.STOP || res === module.ERROR){
					return nested ?
						res
						: this }
				continue }
			// unhandled...
			unhandled.push(arg) }
		// call env handlers that were not explicitly called yet...
		typeof(process) != 'unhandled'
			&& this.envOptions()
				.forEach(function([k, a, d, handler]){
					env.has(handler)	
						|| (handler.env in process.env
							&& runHandler(handler, a, null, rest)) })
		// post handlers...
		root_value = root_value && this.handleArgumentValue ?
			this.handleArgumentValue(this, root_value)
			: root_value
		afterCallbackCall('parsing', this, unhandled, root_value)

		return this },

	// NOTE: see general doc...
	__init__: function(spec){
		Object.assign(this, spec) },
})




/**********************************************************************
* vim:set ts=4 sw=4 nowrap :                        */ return module })
