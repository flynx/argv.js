#!/usr/bin/env node

// compatible with both node's and RequireJS' require(..)
var argv = require('../argv')

var parser = 
exports.parser =
argv.Parser({
		// option definitions...
		// ...
	})
	.then(function(){
		// things to do after the options are handled...
		// ...
	})

// run the parser...
__filename == (require.main || {}).filename
	&& parser(process.argv)

// vim:set ts=4 sw=4 spell :
