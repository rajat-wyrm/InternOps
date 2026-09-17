import { useEffect } from 'react';

let bodyLockCount = 0;
let backgroundBlurCount = 0;
let originalBodyOverflow = '';
let bodyAlreadyHadModalClass = false;

const BLUR_CLASSES = ['blur-sm', 'transition-all', 'duration-300'];

function lockBodyScroll() {
  if (bodyLockCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
    bodyAlreadyHadModalClass = document.body.classList.contains('modal-open');

    document.body.classList.add('modal-open');
  }

  bodyLockCount += 1;
}

function unlockBodyScroll() {
  bodyLockCount = Math.max(0, bodyLockCount - 1);

  if (bodyLockCount !== 0) {
    return;
  }

  document.body.style.overflow = originalBodyOverflow;

  if (!bodyAlreadyHadModalClass) {
    document.body.classList.remove('modal-open');
  }
}

function blurBackground() {
  const root = document.getElementById('root');

  if (backgroundBlurCount === 0 && root) {
    root.classList.add(...BLUR_CLASSES);
  }

  backgroundBlurCount += 1;
}

function restoreBackground() {
  backgroundBlurCount = Math.max(0, backgroundBlurCount - 1);

  if (backgroundBlurCount !== 0) {
    return;
  }

  const root = document.getElementById('root');

  if (root) {
    root.classList.remove(...BLUR_CLASSES);
  }
}

export default function useBodyScrollLock(
  isLocked,
  { blurBackground: shouldBlurBackground = false } = {}
) {
  useEffect(() => {
    if (!isLocked) {
      return undefined;
    }

    lockBodyScroll();

    if (shouldBlurBackground) {
      blurBackground();
    }

    return () => {
      unlockBodyScroll();

      if (shouldBlurBackground) {
        restoreBackground();
      }
    };
  }, [isLocked, shouldBlurBackground]);
}
