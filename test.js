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

		'-test': argv.Parser({
			env: 'TEST',
			arg: 'TEST',
			default: 'moo',
		}).then(function(){
			console.log('TEST', ...arguments) }),

		'@nested': argv.Parser({
			doc: 'nested parser.',

			'@nested': argv.Parser({
				doc: 'nested nested parser.',
			}).then(function(){
				console.log('NESTED NESTED DONE', ...arguments)}),
		}).then(function(){
			console.log('NESTED DONE', ...arguments) }),

		// these aliases will not get shown...

		// dead-end alias...
		'-d': '-dead-end',

		// alias loops...
		'-z': '-z',

		'-x': '-y',
		'-y': '-x',

		'-a': '-b',
		'-b': '-c',
		'-c': '-a',
	})
	.then(function(){
		console.log('DONE', ...arguments) })
	.stop(function(){
		console.log('STOP', ...arguments) })
	.error(function(){
		console.log('ERROR', ...arguments) })



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
	&& p()



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
