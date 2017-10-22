const injection = require('./src/injection');
const lifetime = require('./src/lifetime');
const Container = require('./src/container');
const ObjectBuilder = require('./src/object-builder');

module.exports = {
	Container,
	ObjectBuilder,
	inject: {
		propertyValue: (name, value) => new injection.PropertyValue(name, value),
		property: (name, key) => new injection.Property(name, key),
		method: (name, args) => new injection.Method(name, args)
	},
	lifetime: {
		transient: () => new lifetime.Transient(),
		memory: () => new lifetime.Memory()
	}
};
