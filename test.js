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


var p = argv.Parser({
	'@help': '-help',

	'-v': '-verbose',
	'-verbose': function(){
		console.log('>>> VERBOSE:', ...arguments)
		return 'verbose'
	},

	'-c': '@command',
	'@cmd': '@command',
	'@command': function(){
		console.log('>>> COMMAND:', ...arguments)
		return 'command'
	},
})


console.log('  ->', p(['test', '--verbose', 'a', 'b', 'c']))

console.log('  ->', p(['test', '-c', 'a', 'b', 'c']))

console.log('  ->', p(['test', 'command', 'a', 'b', 'c']))

console.log('---')

p(['test', '-h'])



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
