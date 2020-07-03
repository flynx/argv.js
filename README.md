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
		// XXX
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
```


## License

[BSD 3-Clause License](./LICENSE)

Copyright (c) 2016-2020, Alex A. Naanou,  
All rights reserved.


<!-- vim:set ts=4 sw=4 spell : -->
