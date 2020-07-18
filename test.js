#!/usr/bin/env node
/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var colors = require('colors')
var object = require('ig-object')

var argv = require('./argv')


//---------------------------------------------------------------------


var p = 
module.p =
argv.Parser({
		// disable exit on error...
		handleErrorExit: false,

		'@help': '-help',

		'-verbose': function(){
			console.log('>>> VERBOSE:', ...arguments)
			return 'verbose'
		},

		'-c': '@command',
		'@cmd': '@command',
		'@command': {
			priority: -50,
			handler: function(){
				console.log('>>> COMMAND:', ...arguments)
				return 'command'
			},
		},

		'-r': '-required',
		'-required': {
			doc: 'Required option',
			required: true,
		},

		'-value': {
			doc: 'Value option',
			arg: 'VALUE | valueValue',
			default: 333,
		},

		'-test': argv.Parser({
			env: 'TEST',
			arg: 'TEST',
			default: 'moo',
		}).then(function(){
			console.log('TEST', ...arguments) }),

		'-i': '-int',
		'-int': {
			arg: 'INT|int',
			type: 'int',
			valueRequired: true,
		},

		'@nested': argv.Parser({
			doc: 'nested parser.',

			'@nested': argv.Parser({
				doc: 'nested nested parser.',
			}).then(function(){
				console.log('NESTED NESTED DONE', ...arguments)}),
		}).then(function(){
			console.log('NESTED DONE', ...arguments) }),

		'-\\*': {
			handler: function(){
				console.log('-\\*:', ...arguments) } },

		//'@*': undefined,

		// these aliases will not get shown...

		// dead-end alias...
		'-d': '-dead-end',

		// alias loops...
		'-z': '-z',

		'-x': '-y',
		'-y': '-x',

		'-k': '-l',
		'-l': '-m',
		'-m': '-k',
	})
	//.print(function(...args){
	//	console.log('----\n', ...args)
	//	return argv.STOP })
	.then(function(){
		console.log('DONE', ...arguments) })
	.stop(function(){
		console.log('STOP', ...arguments) })
	.error(function(){
		console.log('ERROR', ...arguments) })



var lang =
module.lang =
argv.Parser({
	// handle both +x and -x
	optionInputPattern: /^([+-])\1?([^+-].*|)$/,

	// XXX for testing, remove when done...
	'-echo': function(...args){
		console.log('ECHO:', ...args)},

	// helpers...
	push: function(...items){
		this.unhandled.splice(this.unhandled.length, 0, ...items) 
		return this },
	exec: function(...items){
		this.rest.splice(0, 0, ...items) 
		return this }, 

	pre_ns: argv.Parser({
	}),

	// XXX do not like the split namespaces....
	ns: {
		'[': [ 'blockto', '[:]' ],
		'(': [ 'blockto', ')', 'exec' ],
		'quote': [ 'quotenn', '0', '1' ],
	},

	'@*': function(code, value){
		this.unhandled.push(...(
			// type-convert...
			/^[+-]?[0-9]+$/.test(value) ?
				[parseInt(value)]
			: /^[+-]?[0-9.]+$/.test(value) ?
				[parseFloat(value)]
			// call user macros...
			: value in this.ns ?
				(this.exec(...this.ns[value]), [])
			// unhandled...
			: [value])) },

	// XXX hanck...
	'@quotenn': function(code){
		var skip = code.shift()
		var quote = code.shift()
		this.push(...code.splice(skip, quote)) },

	// XXX this needs blocks to be already made...
	//	:: ( | name code -- | )
	'@::': function(code){
		this.ns[code.shift()] = code.shift() },

	// XXX revise...
	// 	groupb ( B | .. B -- | [ .. ])
	// 	groupb ( A:B | .. A .. B .. B -- | [ .. [ .. ] .. ])
	'@blockto': function(code, do_pack, value){
		value = value || code.shift()
		value = value instanceof Array ?
			value
			: value.split(':')
		var [f, t] = value.length == 1 ? 
			[undefined, ...value] 
			: value
		var pack = []
		var cur = code.shift()
		while(code.length > 0 && cur != t){
			cur = cur == f ?
				this['@blockto'](code, false, value)
				: cur
			pack.push(cur) 
			cur = code.shift() }
		do_pack !== false
			&& code.unshift(pack)
		return pack },
	'@exec': function(code){
		var c = this.unhandled.pop()
		code.splice(0, 0, ...(c instanceof Array ? c : [c])) },

	'@exit': '-',

	'@dup': function(){
		this.push(...this.unhandled.slice(-1)) },
	'@dup2': function(){
		this.push(...this.unhandled.slice(-2)) },

	'@print': function(){
		this.print(this.unhandled.pop()) },

	'@add': function(){
		var [b, a] = [this.unhandled.pop(), this.unhandled.pop()]
		this.unhandled.push(a + b) },
	'@sub': function(){
		var [b, a] = [this.unhandled.pop(), this.unhandled.pop()]
		this.unhandled.push(a - b) },
	'@mul': function(){
		var [b, a] = [this.unhandled.pop(), this.unhandled.pop()]
		this.unhandled.push(a * b) },
	'@div': function(){
		var [b, a] = [this.unhandled.pop(), this.unhandled.pop()]
		this.unhandled.push(a / b) },

})
.then(function(){
	this.print('>>>', this.unhandled) })


/*
console.log('  ->', p(['test', '--verbose', 'a', 'b', 'c']))

console.log('  ->', p(['test', '-c', 'a', 'b', 'c']))

console.log('  ->', p(['test', 'command', 'a', 'b', 'c']))

console.log('---')


p(['test', 'nested', '-h'])


p(['test', '-h'])
//*/

typeof(__filename) != 'undefined'
	&& __filename == (require.main || {}).filename
	//&& console.log(p())
	&& console.log(lang())



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
