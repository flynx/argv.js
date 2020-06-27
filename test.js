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

		//'-v': '-verbose',
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

		// XXX dead-end alias...
		'-d': '-dead-end',

		'@test': argv.Parser({
		}),

		'@nested': argv.Parser({
			doc: 'nested parser.',

			'@nested': argv.Parser({
				doc: 'nested nested parser.',
			}),
		}),
	})
	.then(function(){
		console.log('DONE') })
	.stop(function(){
		console.log('STOP') })
	.error(function(){
		console.log('ERROR') })



/*
console.log('  ->', p(['test', '--verbose', 'a', 'b', 'c']))

console.log('  ->', p(['test', '-c', 'a', 'b', 'c']))

console.log('  ->', p(['test', 'command', 'a', 'b', 'c']))

console.log('---')


p(['test', 'nested', '-h'])


p(['test', '-h'])
//*/

if(typeof(__filename) != 'undefined'
		&& __filename == (require.main || {}).filename){

	p(process.argv)
}


/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
