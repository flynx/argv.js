# argv.js

Simple argv parser


## Motivation

I needed a new argv parser for a quick and dirty project I was working 
on and evaluating and selecting the proper existing parser and then 
learning its API, quirks and adapting the architecture to it seemed 
to be more complicated, require more effort and far less fun than 
putting together a trivial parser myself in a couple of hours.  
This code is an evolution of that parser.


## Features

- Simple
- Supports both the _option_ (a-la `find`) and _command_ (a-la `git`) paradigms
- Nestable  
  parsers can be nested as option/command handlers defining independent 
  nested contexts
- Option expansion  
  `-abc` expands to `-a -b -c` if `-abc` is not defined
- Option/command value passing  
  implicit `-a 123` (requires definition or manual handling) or explicit 
  `-a=123`
- Environment variable option/command values  
  env can control option defaults
- Reasonable defaults
  - `-help` &ndash; generate and print help,
  - `-version` &ndash; print version,
  - `-` &ndash; stop argument processing,
  - common option aliases
- Extensible:
  - Hooks for option value conversion _(XXX should this be implemented???)_
  - Hooks for dynamic option/command handling
  - Customizable error and stop condition handling


<!-- XXX ### Alternatives -->

## Contents
- [argv.js](#argvjs)
	- [Motivation](#motivation)
	- [Features](#features)
	- [Contents](#contents)
	- [Installation](#installation)
	- [Basic usage](#basic-usage)
	- [Configuration](#configuration)
		- [Options, commands and aliases](#options-commands-and-aliases)
		- [Help](#help)
			- [Value placeholders](#value-placeholders)
			- [Automatically defined values](#automatically-defined-values)
			- [`.doc`](#doc)
			- [`.usage`](#usage)
			- [`.version`](#version)
			- [`.license`](#license)
			- [`.examples`](#examples)
			- [`.footer`](#footer)
			- [Help formatting](#help-formatting)
				- [`.helpColumnOffset`](#helpcolumnoffset)
				- [`.helpColumnPrefix`](#helpcolumnprefix)
				- [`.helpArgumentSeparator`](#helpargumentseparator)
				- [`.helpValueSeparator`](#helpvalueseparator)
		- [Nested parsers](#nested-parsers)
	- [Components and API](#components-and-api)
		- [`THEN`, `STOP` and `ERROR`](#then-stop-and-error)
		- [`Parser(..)`](#parser)
			- [`.then(..)`](#then)
			- [`.stop(..)`](#stop)
			- [`.error(..)`](#error)
			- [`.off(..)`](#off)
			- [`<parser>(..)`](#parser-1)
	- [Advanced parser API](#advanced-parser-api)
		- [`.print(..)` / `.printError(..)`](#print--printerror)
		- [`.handlerDefault(..)`](#handlerdefault)
		- [`.handleArgument(..)`](#handleargument)
		- [`.handleArgumentValue(..)`](#handleargumentvalue)
		- [`.handleErrorExit(..)`](#handleerrorexit)
	- [License](#license-1)


## Installation

```shell
$ npm install ig-argv
```

## Basic usage

Create a script and make it runnable
```shell
$ touch script.js
$ chmod +x script.js
```

Now for the code
```javascript
#!/usr/bin/env node

// compatible with both node's and RequireJS' require(..)
var argv = require('ig-argv')

var parser = argv.Parser({
		// basic/quick option...
		'-b': '-basic',
		'-basic': function(){
			// ...
		},

		// full option settings...
		'-f': '-full',
		'-full': {
			doc: 'Option help',
			// option value to be displayed in help (optional)
			arg: 'VALUE',

			// value key (optional)
			// NOTE: if .handler(..) is defined this is ignored.
			key: 'fullValue',
			// envioroment value (optional)
			env: 'VALUE',
			// default value (optional)
			default: 123,
			// required status (optional)
			required: false,

			// handler (optional)
			handler: function(opts, key, value){
				// ...
			},
		},

		// command...
		// NOTE: the only difference between an option and a command is
		//		the prefix ('-' vs. '@') that determines how it is parsed,
		//		otherwise they are identical and can alias each other...
		'@cmd', '@command',
		'@command': {
			// ...
		},

		// example command-option alias...
		'@help': '-help',

		// nested parser...
		'@nested': argv.Parser({
			// ...
		}).then(function(){
			// ...
		}),
	})
	.then(function(){
		// XXX
	})

// run the parser only if script.js is run directly...
if(__filename == require.main){
	parser(process.argv) }
```

This will create a parser that supports the folowing:
```shell
$ ./script.js --help 

$ ./script.js command

$ ./script.js nested -h

$ ./script.js -fb

```

## Configuration

This sections lists attributes and methods designed to be set/modified in
`<spec>` passed to `Parser(..)`.

Note that these attributes are the same attributes inherited by `<parser>`
(parser instance) and are simply merged into the new instance created by
`Parser(..)`, this there are no restrictions on what attributes/methods
can be overloaded in this way but care must be taken when overloading
elements that were not designed to be overloaded.

```javascript
var parser = Parser({

})
```

### Options, commands and aliases

### Help 

`Parser` defines a default help generator via the `-h` and `-help` options.

By default `-help` will output in the following format:
```
<usage>

<doc>

Options:
	<option-spec> <option-val>		
				- <option-doc>
				  (<opt-required>, <opt-default>, <opt-env>)
	...

Dynamic options:
	...

Commands:
	...

Examples:
	...

<footer>
```
All sections are optional and will not be rendered if they contain no data.


#### Value placeholders

All documentation strings can contain special placeholders that 
will get replaced with appropriate values when rendering help.

- `$SCRIPTNAME` replaced with the value of `.scriptName`,
- `$VERSION` replaced with `.version`,
- `$LICENSE` replaced with `.license`.

#### Automatically defined values

These values are set by the parser just before parsing starts:
- `.script` - full script path, usually this is the value of `argv[0]`,
- `.scriptName` - basename of the script,
- `.scriptPath` - path of the script.

These will be overwritten when the parser is called.

#### `.doc`
Script documentation.

    <spec>.doc = <string> | <function>

Default value: `undefined`

#### `.usage`
Basic usage hint.

    <spec>.usage = <string> | <function> | undefined

Default value: `"$SCRIPTNAME [OPTIONS]"`

#### `.version`
Version number.

    <spec>.usage = <string> | <function> | undefined

If this is not defined `-version` will print `"0.0.0"`.

Default value: `undefined`

#### `.license`
Short license information.

    <spec>.usage = <string> | <function> | undefined

Default value: `undefined`

#### `.examples`

    <spec>.usage = <string> | <list> | <function> | undefined

Example list format:

	[
		[<example-code>, <example-doc>, ...],
		...
	]

Default value: `undefined`

#### `.footer`
Aditional information.

    <spec>.footer = <string> | <function> | undefined

Default value: `undefined`

#### Help formatting

##### `.helpColumnOffset`
Default value: `3`

##### `.helpColumnPrefix`
Default value: `"- "`

##### `.helpArgumentSeparator`
Default value: `", "`

##### `.helpValueSeparator`
Default value: `" "`


### Nested parsers


## Components and API

### `THEN`, `STOP` and `ERROR`

Values that if returned by option/command handlers can control the parse flow.

- `THEN` &ndash; Stop parsing and call `.then(..)` callbacks.
- `STOP` &ndash; Stop parsing and call `.stop(..)` callbacks, 
  skipping `.then(..)`.
- `ERROR` &ndash; Stop parsing, call `.error(..)` callbacks and
  exit with an error.

### `Parser(..)`

Construct a parser instance
```
Parser(<spec>)
	-> <parser>
```

#### `.then(..)`

Add callback to `then` "event".
```
<parser>.then(<callback>)
	-> <parser>
```

```
callback(<unhandled>, <root-value>, <rest>)
	-> <obj>
```

`then` is triggered when parsing is done or stopped from an option handler by returning `THEN`.

#### `.stop(..)`

Add callback to `stop` "event".
```
<parser>.stop(<callback>)
	-> <parser>
```

```
callback(<arg>, <rest>)
	-> <obj>
```

`stop` is triggered when a handler returns `STOP`.

#### `.error(..)`

Add callback to `error` "event".
```
<parser>.error(<callback>)
	-> <parser>
```

```
callback(<reason>, <arg>, <rest>)
	-> <obj>
```

`error` is triggered when a handler returns `ERROR`.


#### `.off(..)`

Remove callback from "event".
```
	<parser>.off(<event>, <callback>)
		-> <parser>
```

#### `<parser>(..)`

Execute the `parser` insatance.

Run the parser on `process.argv`
```
<parser>()
	-> <result>
```

Explicitly pass a list of arguments where `<argv>[0]` is treated as 
the script path.
```
<parser>(<argv>)
	-> <result>
```

Explicitly pass both a list of args and script path.
```
<parser>(<argv>, <main>)
	-> <result>
```

If `<main>` is present in `<argv>` all the arguments before it will 
be ignored, otherwise the whole list is processed as if `<main>` was 
its head.

## Advanced parser API

### `.print(..)` / `.printError(..)`

### `.handlerDefault(..)`

### `.handleArgument(..)`

### `.handleArgumentValue(..)`

### `.handleErrorExit(..)`


## License

[BSD 3-Clause License](./LICENSE)

Copyright (c) 2016-2020, Alex A. Naanou,  
All rights reserved.


<!-- vim:set ts=4 sw=4 spell : -->
