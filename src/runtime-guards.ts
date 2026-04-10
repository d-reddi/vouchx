import { errorText } from './core.js';

let devvitUnhandledRejectionGuardInstalled = false;

function shouldIgnoreDevvitLogStreamAuthRejection(reason: unknown): boolean {
  const message = errorText(reason).toLowerCase();
  return (
    message.includes('unauthenticated') &&
    message.includes('failed to authenticate plugin request') &&
    message.includes('upstream request missing or timed out')
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
