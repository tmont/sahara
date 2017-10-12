const should = require('should');
const sahara = require('../../');
const lifetime = sahara.lifetime;

describe('Lifetime', function() {
	it('should store and fetch transiently', function() {
		const transientLifetime = lifetime.transient();
		transientLifetime.store('foo');
		should.not.exist(transientLifetime.fetch());
	});

	it('should store and fetch using memory backing store', function() {
		const memory = lifetime.memory();
		memory.store('foo');
		memory.fetch().should.equal('foo');
	});
});
