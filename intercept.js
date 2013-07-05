var HTTP = require("http");
var Utility = require("lodash");

HTTP.IncomingMessage.prototype.intercept = function(callback) {
	var self = this;

	if(self.intercepted) {
		throw new Error("Intercepted already!");
	}

	// Buffer to contain original data:
	var buffer = new Buffer(0);

	var interception = {
		buffer: null
	};

	self.emit = Utility.wrap(self.emit, function(original, event) {
		if(event == "data") {
			var chunk = arguments[2];
			buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? new Buffer(chunk) : chunk]);
		}
		else if(event == "end") {
			interception.buffer = new Buffer(buffer.length);
			buffer.copy(interception.buffer);

			try {
				// Give observers the opportunity to change things:
				original.call(self, "interception", interception);

				// Adjust "content-length" header accordingly to buffer's contents:
				self.headers["content-length"] = (interception.buffer || "").length;

				original.call(self, "data", interception.buffer);
			}
			catch(exception) {
				console.error(exception.stack);

				// If something went wrong during the interception let's send the original data:
				original.call(self, "data", buffer);
			}

			original.apply(self, Array.prototype.slice.call(arguments, 1));
		}
		else {
			// Any other call to "emit" is simply passed through:
			original.apply(self, Array.prototype.slice.call(arguments, 1));
		}
	});

	self.intercepted = true;

	if(callback) {
		self.on("interception", callback);
	}

	return self;
};

HTTP.ServerResponse.prototype.intercept = function(callback) {
	var self = this;

	if(self.intercepted) {
		throw new Error("Intercepted already!");
	}

	// Buffer to contain original data:
	var buffer = new Buffer(0);

	var interception = {
		buffer: null,
		reasonPhrase: ""
	};

	var original = Utility.pick(self, "writeHead", "write", "end");
//	TODO: there's probably something to do with "addTrailers" also but we won't bother for now...

	self.writeHead = function(statusCode/*, reasonPhrase, headers*/) {
		self.statusCode = statusCode;

		var reasonIsPresent = (typeof arguments[1] == "string");
		interception.reasonPhrase = reasonIsPresent ? arguments[1] : "";

		var headers = reasonIsPresent ? arguments[2] : arguments[1];
		if(headers) {
			for(var name in headers) {
				if(headers.hasOwnProperty(name)) {
					self.setHeader(name, headers[name]);
				}
			}
		}
	};

	self.write = function(chunk) {
		if(chunk && chunk.length) {
			buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk)]);
		}

		return true;
	};

	self.end = function(chunk, encoding) {
		self.write(chunk, encoding);

		Utility.merge(self, original);

		interception.buffer = new Buffer(buffer.length);
		buffer.copy(interception.buffer);

		try {
			// Give observers the opportunity to change things:
			self.emit("interception", interception);
		}
		catch(exception) {
			console.error(exception.stack);

			self.statusCode = 500;
			interception.reasonPhrase = (process.env.NODE_ENV != "production") ? "Interception Failed" : HTTP.STATUS_CODES[500];
// TODO: not sure if this is the best behavior. Maybe we could keep track of the original headers also and send the response as it should have been sent without interception?

			interception.buffer = buffer;
		}

		if(!self.finished) {
			self.setHeader("Content-Length", interception.buffer ? interception.buffer.length : 0);
			self.writeHead(self.statusCode, interception.reasonPhrase || "");

			self.end(interception.buffer || "");
		}
	};

	if(callback) {
		self.on("interception", callback);
	}

	return self;
};
