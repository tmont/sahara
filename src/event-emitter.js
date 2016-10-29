function EventEmitter() {
	this.events = {};
}

EventEmitter.prototype = {
	listeners: function(name) {
		if (!this.events[name]) {
			this.events[name] = [];
		}

		return this.events[name];
	},

	on: function(name, listener) {
		this.listeners(name).push(listener);
	},

	off: function(name, listener) {
		var listeners = this.listeners(name);
		var index = listeners.indexOf(listener);
		if (index !== -1) {
			listeners.splice(index, 1);
		}
	},

	emit: function(name) {
		var args = [].slice.call(arguments, 1);
		this.listeners(name).forEach(function(listener) {
			listener.apply(this, args);
		});
	}
};

module.exports = EventEmitter;
