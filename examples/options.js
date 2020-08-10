#!/usr/bin/env node

var argv = require('../argv')

var parser = 
exports.parser =
argv.Parser({
	doc: 'Example script options',

	// to make things consistent we'll take the version from package.json
	version: require('../package.json').version,

	author: 'John Smith <j.smith@some-mail.com>',
	license: 'BSD-3-Clause',

	footer: 'Written by: $AUTHOR\nVersion: $VERSION / License: $LICENSE',
	
	
	'-flag': {
		doc: 'if given, set .bool' },


	// option with a value...
	'-value': {
		doc: [
			'set .x to X',
			'NOTE: .doc can be multiple lies'],

		// 'X' (i.e. VALUE) is used to indicate the option value in -help 
		// while 'x' (key) is the attribute where the value will be written...
		//
		// NOTE: if no .arg is set option attribute name is used.
		//
		// See the first example in "Calling the script" section below for output.
		arg: 'X | x',

		// the value is optional by default but we can make it required...
		valueRequired: true,
	},


	// setup an alias -r -> -required
	'-r': '-required',

	// a required option...
	'-required': {
		doc: 'set .required_option_given to true',

		// NOTE: we can omit the VALUE part to not require a value...
		// NOTE: of no attr is specified in arg option name is used.
		arg: '| required_option_given',

		default: true,

		// NOTE: by default required options/commands are sorted above normal
		//		options but bellow -help/-version/-quiet/...
		//		(by default at priority 80)
		required: true,
	},


	'-i': {
		doc: 'pass an integer value',

		// NOTE: if not key is given the VALUE name is used as a key, so the 
		// 		value here is assigned to .INT...
		arg: 'INT',

		// convert the input value to int...
		type: 'int',
	},
	

	'-default': {
		doc: 'option with default value',
		arg: 'VALUE | default',

		default: 'some value',

		// keep this near the top of the options list in -help...
		priority: 80,
	},


	'-home': {
		doc: 'set home path',
		arg: 'PATH | home_path',

		// get the default value from the environment variable $HOME...
		env: 'HOME',
	},

	
	// collecting values...
	'-p': '-push',
	'-push': {
		doc: 'push elements to a .list',
		arg: 'ELEM | list',

		// this will add each argument to a -push option to a list...
		collect: 'list',
	},

	'@command': {
		// ...
	},

	// Since options and commands are identical, aliases from one to the 
	// other work as expected...
	'-c': '@command',

	'-active': {
		doc: 'basic active option',
		handler: function(args, key, value){
			// ...
		} },

	'-s': '-shorthand-active',
	'-shorthand-active': function(args, key, value){
		// ...
	},


	'@nested': argv.Parser({
			// ...
		}).then(function(){
			// ...
		}),
	
	'@bare': require('./bare').parser,


	'-then': { 
		handler: function(){
			return argv.THEN } },
	'-stop': { 
		handler: function(){
			return argv.STOP } },


	'-error': {
		handler: function(){
			throw argv.ParserError('something went wrong.') } },
	'-silent-error': {
		handler: function(){
			return argv.ParserError('something went wrong.') } },
	'-critical-error': {
		handler: function(){
			throw 'something went really wrong.' } },
})
.then(function(unhandled, root_value, rest){
	console.log('### finished normally.')
	console.log(this)
})
.stop(function(arg, rest){
	console.log(`### stopped at ${arg}.`)
})
.error(function(reason, arg, rest){
	console.log(`### something went wrong when parsing ${arg}.`)
})


// run the parser...
__filename == (require.main || {}).filename
	&& parser()

// vim:set ts=4 sw=4 spell :
