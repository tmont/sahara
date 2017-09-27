const injection = require('./injection');
const lifetime = require('./lifetime');

module.exports = {
	Container: require('./container'),
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
