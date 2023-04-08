type EventListener = (...args: any[]) => void;

type EventArgMap = {
	[name: string]: any[];
};

export class EventEmitter<TMap extends EventArgMap> {
	private readonly events: Partial<Record<keyof TMap, EventListener[]>>;

	public constructor() {
		this.events = {};
	}

	public listeners(name: keyof TMap): EventListener[] {
		if (!this.events[name]) {
			this.events[name] = [];
		}

		return this.events[name]!;
	}

	public on<K extends keyof TMap>(name: K, listener: (...args: TMap[K]) => void): void {
		this.listeners(name).push(listener);
	}

	public off<K extends keyof TMap>(name: K, listener: (...args: TMap[K]) => void): void {
		const listeners = this.listeners(name);
		const index = listeners.indexOf(listener);
		if (index !== -1) {
			listeners.splice(index, 1);
		}
	}

	public emit<K extends keyof TMap>(name: K, ...args: TMap[K]): void {
		this.listeners(name).forEach((listener) => {
			listener.apply(this, args);
		});
	}
}
