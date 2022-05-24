const should = require('should');
const spawn = require('child_process').spawn;
const path = require('path');

describe('TypeScript', function() {
	it('should successfully compile TypeScript test file', (done) => {
		const file = path.join(__dirname, 'test.ts');
		const tsc = path.resolve(path.join(__dirname, '..', '..', 'node_modules', '.bin', 'tsc'));
		const proc = spawn(tsc, [ '--noEmit', file ]);
		const stdout = [];
		proc.stdout.on('data', chunk => stdout.push(chunk));

		proc.on('exit', () => {
			const output = Buffer.concat(stdout).toString('utf8');
			proc.exitCode.should.equal(0, output);
			done();
		});
	});
});
