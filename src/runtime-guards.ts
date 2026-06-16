import { errorText } from './core.js';

let devvitUnhandledRejectionGuardInstalled = false;

function shouldIgnoreDevvitLogStreamAuthRejection(reason: unknown): boolean {
  const message = `${errorText(reason)}\n${reason instanceof Error ? (reason.stack ?? '') : ''}`.toLowerCase();
  const isPluginAuthTimeout =
    message.includes('unauthenticated') &&
    message.includes('failed to authenticate plugin request') &&
    message.includes('upstream request missing or timed out');
  const isInvalidJwtLogStreamFailure =
    message.includes('unauthenticated') &&
    message.includes('invalid jwt token') &&
    message.includes('token validation failed');

  return (
    isPluginAuthTimeout ||
    isInvalidJwtLogStreamFailure
  );
}

function installDevvitUnhandledRejectionGuard(): void {
  if (
    devvitUnhandledRejectionGuardInstalled ||
    typeof process === 'undefined' ||
    typeof process.on !== 'function'
  ) {
    return;
  }

  process.on('unhandledRejection', (reason) => {
    if (shouldIgnoreDevvitLogStreamAuthRejection(reason)) {
      return;
    }

    const propagatedError = reason instanceof Error ? reason : new Error(errorText(reason));
    setImmediate(() => {
      throw propagatedError;
    });
  });

  devvitUnhandledRejectionGuardInstalled = true;
}

export {
  installDevvitUnhandledRejectionGuard,
  shouldIgnoreDevvitLogStreamAuthRejection,
};
