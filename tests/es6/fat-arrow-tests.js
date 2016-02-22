'use strict';
var should = require('should'),
	sahara = require('../../'),
	Container = sahara.Container;

describe('fat arrow functions', function() {
	it('should register and resolve fat-arrow function', function() {
		var instance = {},
			resolved = new Container()
				.registerFactory(() => { return instance; }, {key: 'poopoo'})
				.resolveSync('poopoo');

		resolved.should.equal(instance);
	});

	it('should require specified key if fat arrow function without arguments given', function() {
		(function() { new Container().registerType(() => {}); })
				.should
				.throwError('A resolution key must be given if a named function is not');
	});

	it('should require specified key if fat arrow function with single argument without parens given', function() {
		(function() { new Container().registerType(foo => {}); })
				.should
				.throwError('A resolution key must be given if a named function is not');
	});

	it('should require specified key if fat arrow function with multiple arguments given', function() {
		(function() { new Container().registerType((foo, bar) => {}); })
				.should
				.throwError('A resolution key must be given if a named function is not');
	});
});
