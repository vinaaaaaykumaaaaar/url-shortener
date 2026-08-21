/**
 * Shared between the app and the server that hosts it: the app is built before anything is
 * listening, but the readiness probe inside it has to observe a state only the shutdown sequence
 * knows about. Passing this object from the composition root keeps that link explicit — a
 * module-level flag would work until the second server in one process, and is invisible to tests.
 */
export interface Lifecycle {
    readonly draining: boolean;
    startDraining(): void;
}

export function createLifecycle(): Lifecycle {
    let draining = false;

    return {
        get draining() {
            return draining;
        },
        startDraining() {
            draining = true;
        },
    };
}
