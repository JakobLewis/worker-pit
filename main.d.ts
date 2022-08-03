/// <reference types="node" />
/// <reference types="node" />
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
export declare class PitWorker<Input, Result> extends Worker {
    enclosedPromise: DeferredPromise<Input, Result | null> | null;
    lastUsed: number;
    stopFlagged: boolean;
    errorTrace: Error | null;
    exitCode: number | null;
    constructor(filename: string, options?: WorkerOptions);
    giveWork(work: DeferredPromise<Input, Result | null>): void;
}
export default class WorkerPit<Input, Result> {
    private workers;
    private freeWorkers;
    private bootingWorkers;
    workPile: DeferredPromise<Input, Result | null>[];
    events: PitEvents<Input, Result>;
    workPath: string;
    minWorkers: number;
    maxWorkers: number;
    workerTimeout: number;
    constructor(workPath: string, maxWorkers: number, minWorkers?: number, workerTimeout?: number, cleaningPeriod?: number);
    get workerCount(): number;
    get freeWorkerCount(): number;
    get utilisation(): number;
    private addWorker;
    private deleteWorker;
    clean(): void;
    poll(): void;
    throwWork(data: Input): Promise<Result | null>;
}
export {};
