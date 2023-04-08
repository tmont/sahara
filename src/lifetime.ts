export interface Lifetime {
	fetch<T = unknown>(): T | null;
	store(value: unknown): void;
}

export class MemoryLifetime implements Lifetime {
	private value: unknown | null;

	public constructor() {
		this.value = null;
	}

	public fetch<T = unknown>(): T | null {
		return this.value as any;
	}

	public store(value: unknown) {
		this.value = value;
	}
}

export class TransientLifetime implements Lifetime {
	public fetch() {
		return null;
	}

	public store(value: unknown) {}
}
