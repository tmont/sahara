var should = require('should'),
	lifetime = require('../').lifetime,
	ObjectManager = require('../').ObjectManager;

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

	it('should store and fetch using externally managed object', function() {
		var manager = new ObjectManager(),
			external = lifetime.external(manager),
			addEmitted = false,
			purgeEmitted = false;

		manager.on('add', function(key, value) {
			addEmitted = true;
			key.should.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
			value.should.equal('foo');
		});

		manager.on('purge', function() {
			purgeEmitted = true;
		});

		external.store('foo');
		addEmitted.should.equal(true);

		external.fetch().should.equal('foo');

		manager.purge();
		purgeEmitted.should.equal(true);

		should.not.exist(external.fetch());
	});

	it('should store and fetch using externally managed object with injected collection', function() {
		var items = {
			foo: 'bar'
		};
		var manager = new ObjectManager(items),
			external = lifetime.external(manager);

		external.store('foo');
		external.fetch().should.equal('foo');
		manager.purge();
		should.not.exist(external.fetch());

		items.should.have.property('foo', 'bar');
	});

	it('should require instance of ObjectManager for externally managed lifetime', function() {
		(function() { lifetime.external({}); })
			.should.throwError('An ObjectManager instance must be provided');
	});
});