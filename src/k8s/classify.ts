import { K8sLogError, type LogErrorCode } from './types';

export function classifyLogError(stderr: string, previous: boolean): LogErrorCode {
    const t = stderr.toLowerCase();
    if (previous && /previous terminated container|no previous/.test(t)) return 'no_previous';
    if (/not found|notfound|not yet been created|waiting to start/.test(t)) return 'unavailable';
    if (/forbidden|unauthorized|unable to connect|was refused|i\/o timeout/.test(t)) return 'unavailable';
    return 'failed';
}

export function logError(stderr: string, previous: boolean): K8sLogError {
    return new K8sLogError(stderr.trim() || 'kubectl logs failed', classifyLogError(stderr, previous));
}
