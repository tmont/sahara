var EventEmitter = require('events').EventEmitter,
	util = require('util');

function ObjectManager(collection) {
	this.items = collection || {};
	this.keys = [];
}

util.inherits(ObjectManager, EventEmitter);

util._extend(ObjectManager.prototype, {
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