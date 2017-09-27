exports.getTypeInfo = (ctor, key, ignoreSignature) => {
	if (typeof(ctor) !== 'function') {
		const message = ctor && ctor.constructor
			? 'instance of ' + ctor.constructor.name
			: (!ctor ? 'null' : typeof(ctor));
		throw new Error('Constructor must be a function, got ' + message);
	}

	const docCommentRegex = [
		//normal function or es6 class method
		/^(?:function\s+)?(?:(\w+))?\s*\(([^)]*)\)\s*\{/,
		//class with constructor
		/^class(?:[\s+](\w+))?[\s\S]+?constructor\s*\(([^)]*)\)\s*\{/,
		//class without constructor
		/^class(?:[\s+](\w+))?/,
		//fat arrow functions (always anonymous, so first group capture must be empty)
		/^()\(?([^)]*)\)?\s*=>\s*\{/
	];

	let data;

	for (let i = 0; i < docCommentRegex.length; i++) {
		data = docCommentRegex[i].exec(ctor.toString());
		if (data) {
			break;
		}
	}

	if (!data) {
		throw new Error(
			`Unable to parse function definition: ${ctor.toString()}. If ` +
			'this is a valid constructor, please open an issue with the developers.'
		);
	}

	const typeName = key || data[1];
	const signature = (data[2] || '').trim();
	if (!typeName) {
		throw new Error('A resolution key must be given if a named function is not');
	}

	const typeInfo = {
		args: [],
		ctor: ctor,
		name: typeName
	};

	if (!ignoreSignature && signature) {
		signature.split(',').forEach(function(param, i) {
			const paramTrimmed = param.trim();
			//ferret out the type of each argument based on inline jsdoc:
			//https://code.google.com/p/jsdoc-toolkit/wiki/InlineDocs
			const data = /^\/\*\*\s*([^*\s]+?)\s*\*+\/\s*(\w+)\s*$/.exec(paramTrimmed);
			if (!data) {
				throw new Error(
					`Unable to determine type of parameter at position ${i + 1}` +
					` ("${paramTrimmed}") for type "${typeName}"; are you ` +
					'missing a doc comment?'
				);
			}

			typeInfo.args.push({
				position: i,
				type: data[1],
				name: data[2]
			});
		});
	}

	return typeInfo;
};
