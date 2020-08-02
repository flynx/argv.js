#!/usr/bin/env node

var argv = require('../argv')

var parser = 
exports.parser =
argv.Parser({
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




__filename == (require.main || {}).filename
	&& parser()
	
// vim:set ts=4 sw=4 spell :
