var EventEmitter = require('./event-emitter'),
	merge = require('./merge');

function ObjectManager(collection) {
	EventEmitter.call(this);
	this.items = collection || {};
	this.keys = [];
}

merge(ObjectManager.prototype, EventEmitter.prototype, {
	get: function(key) {
		return this.items[key];
	},

	add: function(key, object) {
		this.items[key] = object;
		this.keys.push(key);
		this.emit('add', key, object);
	},

	purge: function() {
		var self = this;
		this.keys.forEach(function(key) {
			delete self.items[key];
		});

		this.keys = [];
		this.emit('purge');
	}
});

module.exports = ObjectManager;
