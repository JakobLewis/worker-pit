import { EventEmitter } from 'stream';
import { Worker, WorkerOptions } from 'worker_threads';

/**
 * Used to connect WorkerPit Promises with Worker message events.
 */
interface DeferredPromise<Input, Result> {
    resolve: (_: Result) => void;
    reject: (_: Error) => void;
    data: Input;
}

/**
 * Defining the values of WorkerPit events for typechecking.
 */
interface PitEvents<Input, Result> extends EventEmitter {
    on(event: 'workDispatched', listener: () => void): this;
    on(event: 'workComplete', listener: () => void): this;
    on(event: 'workerCreated', listener: (worker: PitWorker<Input, Result>) => void): this;

    emit(event: 'workDispatched'): boolean;
    emit(event: 'workComplete'): boolean;
    emit(event: 'workerCreated', worker: PitWorker<Input, Result>): boolean;
}

export class PitWorker<Input, Result> extends Worker {
    enclosedPromise: DeferredPromise<Input, Result | null> | null = null;
    lastUsed: number = Date.now();
    stopFlagged: boolean = false;
    errorTrace: Error | null = null;
    exitCode: number | null = null;

    constructor(filename: string, options?: WorkerOptions) {
        super(filename, options);
        this.unref();

        this.addListener('message', (result) => {
            if (this.enclosedPromise == null) throw new Error('Worker thread returned data with no waiting Promise.');
            this.enclosedPromise.resolve(result);
            this.enclosedPromise = null;
            this.lastUsed = Date.now();
            this.unref();
        });

        this.addListener('error', (err) => this.errorTrace = err);

        this.addListener('exit', (code) => {
            this.exitCode = code; // Any code apart from zero indicates an error
            if (this.stopFlagged) return;

            if (this.enclosedPromise) {
                if (code != 0) this.enclosedPromise.reject((this.errorTrace as Error));
                else this.enclosedPromise.resolve(null);
            } else {
                if (code == 0) console.warn('ThreadPit worker exited prematurely.');
                else throw this.errorTrace;
            }
        });
    }

    giveWork(work: DeferredPromise<Input, Result | null>): void {
        if (this.enclosedPromise != null) throw Error('Busy PitWorker cannot take more work.');
        this.enclosedPromise = work;
        this.ref(); // Ensure the main thread does not exit.
        this.postMessage(work.data);
    }
}

export default class WorkerPit<Input, Result> {
    private workers: PitWorker<Input, Result>[] = [];
    private freeWorkers: PitWorker<Input, Result>[] = [];
    private bootingWorkers: number = 0;

    workPile: DeferredPromise<Input, Result | null>[] = [];
    events: PitEvents<Input, Result> = new EventEmitter();

    // Configuration
    workPath: string;
    minWorkers: number;
    maxWorkers: number;
    workerTimeout: number;

    constructor(
        workPath: string, maxWorkers: number, minWorkers: number = 1,
        workerTimeout: number = 3000, cleaningPeriod: number = 3000
    ) {

        this.workPath = workPath;
        this.maxWorkers = maxWorkers;
        this.minWorkers = minWorkers;
        this.workerTimeout = workerTimeout;

        setInterval(() => this.clean(), cleaningPeriod).unref();

        this.events.prependListener('workComplete', () => this.poll());

        this.poll();
    }

    get workerCount(): number {
        return this.workers.length;
    }

    get freeWorkerCount(): number {
        return this.freeWorkers.length + this.bootingWorkers;
    }

    get utilisation(): number {
        return (1 - (this.freeWorkers.length / this.maxWorkers));
    }

    private addWorker(): void {
        const worker: PitWorker<Input, Result> = new PitWorker(this.workPath);
        worker.on('message', () => {
            this.freeWorkers.push(worker);
            this.events.emit('workComplete');
        });
        worker.once('online', () => {
            this.freeWorkers.push(worker);
            this.bootingWorkers -= 1;
            this.poll();
        });
        this.workers.push(worker);
        this.bootingWorkers += 1;
        this.events.emit('workerCreated', worker);
    }

    private deleteWorker(): void {
        const worker = this.freeWorkers.pop();
        if (worker === undefined) return;
        this.workers.splice(this.workers.indexOf(worker), 1);
        worker.stopFlagged = true;
        worker.terminate();
    }

    clean(): void {
        for (let i = 0; i < this.freeWorkers.length; i += 1) {
            if (this.workers.length <= this.minWorkers) return;
            if (Date.now() - (this.freeWorkers[i] as PitWorker<Input, Result>).lastUsed > this.workerTimeout) {
                i -= 1;
                this.deleteWorker();
            }
        }
    }

    poll(): void {
        if (this.freeWorkerCount < this.workPile.length && this.maxWorkers > this.workers.length) this.addWorker();
        if (this.freeWorkers.length > 0 && this.workPile.length > 0) {
            const repetitions = Math.min(this.workPile.length, this.freeWorkers.length);
            for (let i = 0; i < repetitions; i += 1) {
                const work = (this.workPile.shift() as DeferredPromise<Input, Result | null>);
                const worker = (this.freeWorkers.pop() as PitWorker<Input, Result>);
                worker.giveWork(work);
            }
            this.events.emit("workDispatched");
        }
    }

    throwWork(data: Input): Promise<Result | null> {
        return new Promise((resolve, reject) => {
            this.workPile.push({ resolve, reject, data });
            this.poll();
        })
    }
}