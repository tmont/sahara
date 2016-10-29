var should = require('should'),
	sahara = require('../../'),
	lifetime = sahara.lifetime;

describe('Lifetime', function() {
	it('should store and fetch transiently', function() {
		var transientLifetime = lifetime.transient();
		transientLifetime.store('foo');
		should.not.exist(transientLifetime.fetch());
	});

	it('should store and fetch using memory backing store', function() {
		var memory = lifetime.memory();
		memory.store('foo');
		memory.fetch().should.equal('foo');
	});
});
