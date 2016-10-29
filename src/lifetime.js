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

module.exports = {
	Memory: MemoryLifetime,
	Transient: TransientLifetime
};
