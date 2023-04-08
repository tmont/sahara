import {Constructor, TypeInfo} from './types';

export const argPrefix = '$arg:';

const nope = (x: never) => {};

interface DocCommentRegexItem {
	type: 'function' | 'method' | 'class-with-ctor' | 'class-without-ctor' | 'fat-arrow' | 'function-anon';
	regex: RegExp;
}

const verifyCtorType: (ctor: unknown) => void = (ctor: unknown): asserts ctor is Constructor => {
	if (typeof(ctor) !== 'function') {
		const message = typeof(ctor) === 'object' && ctor
			? 'instance of ' + ctor.constructor.name
			: (!ctor ? 'null' : typeof (ctor));
		throw new Error('Constructor must be a function, got ' + message);
	}
};

export const getTypeInfo = (ctor: Function, key?: string, type?: 'method') => {
	verifyCtorType(ctor);

	const constructorName = ctor.name;

	const docCommentRegex: DocCommentRegexItem[] = [
		//normal function
		{ type: 'function', regex: /^function\s+(\w+)?\s*\(([^)]*)\)\s*{/ },
		//anonymous function
		{ type: 'function-anon', regex: /^function\s*\(([^)]*)\)\s*{/ },
		//class with constructor
		{ type: 'class-with-ctor', regex: /^class(?:\s+(\w+))?[\s\S]+?constructor\s*\(([^)]*)\)\s*{/ },
		//class without constructor
		{ type: 'class-without-ctor', regex: /^class(?:\s+(\w+))?/ },
		//fat arrow functions (always anonymous, so first group capture must be empty)
		{ type: 'fat-arrow', regex: /^()\(?([^)]*)\)?\s*=>/ },
	];

	let data: RegExpExecArray | null = null;
	let matched: DocCommentRegexItem | null = null;

	if (type === 'method') {
		//es6 class method
		matched = {
			type: 'method',
			regex: /^(\w+)\s*\(([^)]*)\)\s*{/
		};

		data = matched.regex.exec(ctor.toString());
	} else {
		for (let i = 0; i < docCommentRegex.length; i++) {
			data = docCommentRegex[i].regex.exec(ctor.toString());
			if (data) {
				matched = docCommentRegex[i];
				break;
			}
		}
	}

	if (!data || !matched) {
		throw new Error(
			`Unable to parse function definition: ${ctor.toString()}. If ` +
			'this is a valid constructor, please open an issue with the developers.'
		);
	}

	const typeName = key || data[1] ||
		(matched.type === 'class-with-ctor' || matched.type === 'class-without-ctor' || matched.type === 'function' ?
			constructorName :
			null
		);
	const signature = (data[2] || '').trim();
	if (!typeName || typeName === 'function') {
		throw new Error('A resolution key must be given if a named function is not');
	}

	const typeInfo: TypeInfo = {
		args: [],
		ctor: ctor,
		name: typeName,
		constructable: false,
	};

	switch (matched.type) {
		case 'method':
		case 'fat-arrow':
			typeInfo.constructable = false;
			break;
		case 'function':
		case 'function-anon':
		case 'class-with-ctor':
		case 'class-without-ctor':
			typeInfo.constructable = true;
			break;
		default:
			nope(matched.type);
			break;
	}

	if (signature) {
		signature.split(',').forEach((param, i) => {
			const paramTrimmed = param.trim();
			if (!paramTrimmed) {
				//dangling comma
				return;
			}
			//ferret out the type of each argument based on inline jsdoc:
			//https://code.google.com/p/jsdoc-toolkit/wiki/InlineDocs
			const data = /^\/\*\*\s*([^*\s]+?)\s*\*+\/\s*(\w+)\s*$/.exec(paramTrimmed);

			if (!data) {
				// assume it will be resolved via implicit arg:* syntax
				typeInfo.args.push({
					position: i,
					type: `${argPrefix}${paramTrimmed}`,
					name: paramTrimmed,
					parsedAs: 'arg'
				});
			} else {
				typeInfo.args.push({
					position: i,
					type: data[1],
					name: data[2],
					parsedAs: 'doc-comment'
				});
			}
		});
	}

	return typeInfo;
};
