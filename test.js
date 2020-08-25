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
var test = require('ig-test')

var argv = require('./argv')


//---------------------------------------------------------------------

argv.Parser.typeHandlers.error = function(){
	throw new argv.ParserTypeError('type error') }



//---------------------------------------------------------------------

var setups = 
test.Setups({
	bare: function(){
		return require('./examples/bare').parser },
	options: function(){
		return require('./examples/options').parser },
	lang: function(){
		return require('./examples/lang').parser },
	chain: function(){
		return require('./examples/chain').parser },

	// NOTE: this will also load .bare, .options and .lang
	basic: function(assert){
		return argv.Parser({
			// disable exit on error...
			handleErrorExit: false,

			'@help': '-help',

			'-verbose': function(){
				console.log('>>> VERBOSE:', ...arguments)
				return 'verbose' },

			'-blank': {},

			'-c': '@command',
			'@cmd': '@command',
			'@command': {
				priority: -50,
				handler: function(){
					console.log('>>> COMMAND:', ...arguments)
					return 'command' },
			},

			'-r': '-required',
			'-required': {
				doc: 'Required option',
				required: true,
			},

			'-prefix': {
				doc: 'prefix test',
				handler: function(opts, key, value){
					console.log('PREFIX:', key[0]) }, },

			'-value': {
				doc: 'Value option',
				arg: 'VALUE | valueValue',
				default: 333,
			},

			'-c': '-collection',
			'-collection': {
				doc: 'collect ELEM',
				arg: 'ELEM | elems',
				collect: 'set',
			},
			'-t': '-toggle',
			'-toggle': {
				doc: 'toggle value',
				arg: '| toggle_value',
				collect: 'toggle',
			},
			'-s': '-string',
			'-string': {
				doc: 'collect tab-separated strings',
				arg: 'STR | str',
				collect: 'string|\t',
			},
			//'-a': '-ab',
			'-sh': {
				doc: 'short option', },

			'-env': {
				doc: 'env value',
				arg: 'VALUE | env_value',
				env: 'VALUE',

				//default: 5,
				handler: function(args, key, value){ console.log('GOT ENV:', value) },
			},

			'-type-error': {
				doc: 'throw a type error',
				type: 'error', 
			},
			'-error': {
				doc: 'throw an error',
				handler: function(){
					throw argv.ParserError('error: $ARG') }},
			'-passive-error': {
				doc: 'throw an error',
				handler: function(){
					return argv.ParserError('error') }},


			'-test': argv.Parser({
				env: 'TEST',
				arg: 'TEST',
				default: function(){
					return this['-value'].default },
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

			'-n': {
				doc: 'proxy to nested',
				handler: function(){
					return this.handle('nested', ...arguments) }, },

			'-\\*': {
				handler: function(){
					console.log('-\\*:', ...arguments) } },

			//'@*': undefined,

			// these aliases will not get shown...

			// dead-end alias...
			'-d': '-dead-end',

			// alias loops...
			// XXX should we detect and complain about these???
			// 		...maybe in a test function??
			'-z': '-z',

			'-x': '-y',
			'-y': '-x',

			'-k': '-l',
			'-l': '-m',
			'-m': '-k',


			'@bare': setups.bare(assert),
			'@opts': setups.options(assert),
			'@lang': setups.lang(assert),
			'@chain': setups.chain(assert),


			// collision test...
			// NOTE: values of these will shadow the API...
			'@options': {},
			'-handler': {},
		})
		//.print(function(...args){
		//	console.log('----\n', ...args)
		//	return argv.STOP })
		.then(function(){
			console.log('DONE', ...arguments) })
		.stop(function(){
			console.log('STOP', ...arguments) })
		.error(function(){
			console.log('ERROR', ...arguments) }) }
})

test.Modifiers({
})

test.Tests({
})

test.Cases({
})


/*
console.log('  ->', p(['test', '--verbose', 'a', 'b', 'c']))

console.log('  ->', p(['test', '-c', 'a', 'b', 'c']))

console.log('  ->', p(['test', 'command', 'a', 'b', 'c']))

console.log('---')


p(['test', 'nested', '-h'])


p(['test', '-h'])
//*/


//---------------------------------------------------------------------

typeof(__filename) != 'undefined'
	&& __filename == (require.main || {}).filename
	&& console.log(setups.basic()())
	//&& test.run()



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
