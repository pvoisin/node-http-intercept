# Usage

Approach is pretty simple: just call the `intercept` method on either request or response and register for the "`interception`" event (or just pass your callback when calling `intercept`).
When it is triggered you'll get the intercepted data. At that point you could do whatever you want with it, then normal flow of things will resume...


## Modifying Request Data
Let's say you want to change incoming data:

```
var HTTP = require("http");
var Query = require("querystring");
var read = require("concat-stream");

var server = HTTP.createServer(function(request, response) {
//*
	request.intercept(function(context) {
		context.buffer = "user=Jack";
	});
//*/

	request.pipe(read(function(data) {
		var query = Query.parse(String(data) || "");
		response.end("Hello, " + query.user + "!");
	}));
}).listen(80);
```
<u>Note</u>: post something like "user=Barnabé" and you'll see that it is turned into "Jack" in the greeting message.


## Modifying Response Data

```
var HTTP = require("http");
var Query = require("querystring");
var read = require("concat-stream");

var server = HTTP.createServer(function(request, response) {
	var user;
//*
	request.intercept(function(context) {
		user = Query.parse(String(context.buffer) || "").user;
		context.buffer = "user=Jack";
	});
//*/

//*
	response.intercept(function(context) {
		context.buffer = "Well... I guess you're not " + query.user + ", but " + user + ", right?";
	});
//*/

	var query;

	request.pipe(read(function(data) {
		query = Query.parse(String(data) || "");
		response.end("Hello, " + query.user + "!");
	}));
}).listen(80);
```