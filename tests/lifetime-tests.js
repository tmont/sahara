var should = require('should'),
	Lifetime = require('../').Lifetime;

describe('Lifetime', function() {
	it('should store and fetch transiently', function() {
		var lifetime = new Lifetime.Transient();
		lifetime.store('foo');
		should.not.exist(lifetime.fetch());
	});

	it('should store and fetch using memory backing store', function() {
		var lifetime = new Lifetime.Memory();
		lifetime.store('foo');
		lifetime.fetch().should.equal('foo');
	});
});