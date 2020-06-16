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
	'@help': '-help',

	'-v': '-verbose',
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

	// XXX this for some reason breaks...
	//'@test': argv.Parser({
	//}),

	'@nested': argv.Parser({
		doc: 'nested parser.',

	}),
})



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
