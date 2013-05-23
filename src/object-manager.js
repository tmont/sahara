var EventEmitter = require('events').EventEmitter,
	util = require('util');

function ObjectManager() {
	this.items = {};
}

util.inherits(ObjectManager, EventEmitter);

util._extend(ObjectManager.prototype, {
	get: function(key) {
		return this.items[key];
	},

	add: function(key, object) {
		this.items[key] = object;
		this.emit('add', key, object);
	},

	purge: function() {
		this.items = {};
		this.emit('purge');
	}
});

module.exports = ObjectManager;