"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PitWorker = void 0;
const stream_1 = require("stream");
const worker_threads_1 = require("worker_threads");
/**
 *
 */
class PitWorker extends worker_threads_1.Worker {
    enclosedPromise = null;
    lastUsed = Date.now();
    stopFlagged = false;
    errorTrace = null;
    exitCode = null;
    constructor(filename, options) {
        super(filename, options);
        this.addListener('message', (result) => {
            if (this.enclosedPromise == null)
                throw new Error('Worker thread returned data with no waiting Promise.');
            this.enclosedPromise.resolve(result);
            this.enclosedPromise = null;
            this.lastUsed = Date.now();
        });
        this.addListener('error', (err) => this.errorTrace = err);
        this.addListener('exit', (code) => {
            this.exitCode = code; // Any code apart from zero indicates an error
            if (this.stopFlagged)
                return;
            if (this.enclosedPromise) {
                if (code != 0)
                    this.enclosedPromise.reject(this.errorTrace);
                else
                    this.enclosedPromise.resolve(null);
            }
            else {
                if (code == 0)
                    console.warn('ThreadPit worker exited prematurely.');
                else
                    throw this.errorTrace;
            }
        });
    }
    giveWork(work) {
        if (this.enclosedPromise != null)
            throw Error('Busy PitWorker cannot take more work.');
        this.enclosedPromise = work;
        this.postMessage(work.data);
    }
}
exports.PitWorker = PitWorker;
class WorkerPit {
    workers = [];
    freeWorkers = [];
    workPile = [];
    events = new stream_1.EventEmitter();
    // Configuration
    workPath;
    minWorkers;
    maxWorkers;
    workerTimeout;
    constructor(workPath, maxWorkers, minWorkers = 1, workerTimeout = 3000, cleaningPeriod = 3000) {
        this.workPath = workPath;
        this.maxWorkers = maxWorkers;
        this.minWorkers = minWorkers;
        this.workerTimeout = workerTimeout;
        setInterval(() => this.clean(), cleaningPeriod).unref();
        this.events.on('workComplete', () => this.poll());
        this.poll();
    }
    get workerCount() {
        return this.workers.length;
    }
    get freeWorkerCount() {
        return this.freeWorkers.length;
    }
    addWorker() {
        const worker = new PitWorker(this.workPath);
        this.events.emit('workerCreated', worker);
        worker.on('message', () => {
            this.freeWorkers.push(worker);
            this.events.emit('workComplete');
        });
        worker.once('online', () => {
            this.freeWorkers.push(worker);
            this.poll();
        });
        this.workers.push(worker);
    }
    deleteWorker() {
        const worker = this.freeWorkers.pop();
        if (worker === undefined)
            return;
        this.workers.splice(this.workers.indexOf(worker), 1);
        worker.stopFlagged = true;
        worker.terminate();
    }
    clean() {
        for (let i = 0; i < this.freeWorkers.length; i += 1) {
            if (Date.now() - this.freeWorkers[i].lastUsed > this.workerTimeout) {
                i -= 1;
                this.deleteWorker();
            }
        }
    }
    poll() {
        if (this.workPile.length == 0 && this.freeWorkerCount != 0)
            this.events.emit('idle');
        else if (this.workPile.length != 0 && this.freeWorkers.length == 0) {
            this.events.emit('saturated');
            if (this.maxWorkers > this.workers.length)
                this.addWorker();
        }
        else {
            const repetitions = Math.min(this.workPile.length, this.freeWorkers.length);
            for (let i = 0; i < repetitions; i += 1) {
                const work = this.workPile.shift();
                const worker = this.freeWorkers.pop();
                worker.giveWork(work);
            }
        }
    }
    throwWork(data) {
        return new Promise((resolve, reject) => {
            this.workPile.push({ resolve, reject, data });
            this.poll();
        });
    }
}
exports.default = WorkerPit;
