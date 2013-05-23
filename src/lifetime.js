var uuid = require('node-uuid'),
	ObjectManager = require('./object-manager');

function MemoryLifetime() {
	this.value = null;
}

MemoryLifetime.prototype = {
	fetch: function() {
		return this.value;
	},

	store: function(value) {
		this.value = value;
	}
};

function TransientLifetime() {}
TransientLifetime.prototype = {
	fetch: function() {
		return null;
	},

	store: function(value) {}
};

function ExternallyManagedLifetime(manager) {
	if (!(manager instanceof ObjectManager)) {
		throw new Error('An ObjectManager instance must be provided');
	}

	this.manager = manager;
	this.key = uuid.v4();
}

ExternallyManagedLifetime.prototype = {
	fetch: function() {
		return this.manager.get(this.key);
	},

	store: function(value) {
		this.manager.add(this.key, value);
	}
};

module.exports = {
	Memory: MemoryLifetime,
	Transient: TransientLifetime,
	ExternallyManaged: ExternallyManagedLifetime
};