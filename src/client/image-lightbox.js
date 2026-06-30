const MIN_SCALE = 1;
const MAX_SCALE = 5;
const TAP_MOVE_THRESHOLD = 8;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_DISTANCE = 48;
const DOUBLE_TAP_SCALE = 2.5;

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function touchDistance(firstTouch, secondTouch) {
  return Math.hypot(firstTouch.clientX - secondTouch.clientX, firstTouch.clientY - secondTouch.clientY);
}

function touchCenter(firstTouch, secondTouch) {
  return {
    x: (firstTouch.clientX + secondTouch.clientX) / 2,
    y: (firstTouch.clientY + secondTouch.clientY) / 2,
  };
}

export function createImageLightbox({
  closeButton,
  counter,
  modal,
  nextButton,
  normalizeUrl,
  preview,
  prevButton,
}) {
  const state = {
    photos: [],
    index: 0,
    scrollLock: null,
    scale: MIN_SCALE,
    translateX: 0,
    translateY: 0,
    gesture: null,
    mouseGesture: null,
    lastTap: null,
    suppressNextClick: false,
  };

  function normalizePhotoUrl(value) {
    if (typeof normalizeUrl === 'function') {
      return normalizeUrl(value);
    }
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  function normalizePhotos(photosOrUrl) {
    const list = Array.isArray(photosOrUrl) ? photosOrUrl : [photosOrUrl];
    const normalized = [];
    for (const entry of list) {
      const url = normalizePhotoUrl(typeof entry === 'string' ? entry : entry && entry.url);
      if (url) {
        normalized.push({
          url,
          label: entry && typeof entry === 'object' && entry.label ? String(entry.label) : 'Verification photo',
        });
      }
    }
    return normalized;
  }

  function clampTranslate(translateX = state.translateX, translateY = state.translateY, scale = state.scale) {
    if (!modal || !preview || scale <= MIN_SCALE) {
      return { x: 0, y: 0 };
    }
    const maxX = Math.max(0, (preview.offsetWidth * scale - modal.clientWidth) / 2);
    const maxY = Math.max(0, (preview.offsetHeight * scale - modal.clientHeight) / 2);
    return {
      x: clampNumber(translateX, -maxX, maxX),
      y: clampNumber(translateY, -maxY, maxY),
    };
  }

  function applyTransform() {
    if (!preview || !modal) {
      return;
    }
    const clamped = clampTranslate();
    state.translateX = clamped.x;
    state.translateY = clamped.y;
    preview.style.transform = `translate3d(${state.translateX}px, ${state.translateY}px, 0) scale(${state.scale})`;
    modal.classList.toggle('image-modal-zoomed', state.scale > MIN_SCALE);
  }

  function clearMouseGesture() {
    const gesture = state.mouseGesture;
    state.mouseGesture = null;
    modal?.classList.remove('image-modal-panning');
    if (
      gesture &&
      preview &&
      typeof preview.hasPointerCapture === 'function' &&
      preview.hasPointerCapture(gesture.pointerId)
    ) {
      preview.releasePointerCapture(gesture.pointerId);
    }
  }

  function resetTransform() {
    clearMouseGesture();
    state.scale = MIN_SCALE;
    state.translateX = 0;
    state.translateY = 0;
    state.gesture = null;
    state.lastTap = null;
    if (preview) {
      preview.style.transform = '';
    }
    if (modal) {
      modal.classList.remove('image-modal-zoomed');
    }
  }

  function zoomAtPoint(clientX, clientY, nextScale) {
    if (!modal) {
      return;
    }
    const modalRect = modal.getBoundingClientRect();
    const modalCenterX = modalRect.left + modalRect.width / 2;
    const modalCenterY = modalRect.top + modalRect.height / 2;
    const currentScale = state.scale || MIN_SCALE;
    const contentX = (clientX - modalCenterX - state.translateX) / currentScale;
    const contentY = (clientY - modalCenterY - state.translateY) / currentScale;
    state.scale = clampNumber(nextScale, MIN_SCALE, MAX_SCALE);
    state.translateX = clientX - modalCenterX - contentX * state.scale;
    state.translateY = clientY - modalCenterY - contentY * state.scale;
    applyTransform();
  }

  function lockScroll() {
    if (state.scrollLock) {
      return;
    }
    state.scrollLock = {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      bodyStyle: {
        left: document.body.style.left,
        position: document.body.style.position,
        right: document.body.style.right,
        top: document.body.style.top,
        width: document.body.style.width,
      },
    };
    document.documentElement.classList.add('image-modal-open');
    document.body.classList.add('image-modal-open');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${state.scrollLock.scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  function unlockScroll() {
    if (!state.scrollLock) {
      return;
    }
    const { scrollX, scrollY, bodyStyle } = state.scrollLock;
    state.scrollLock = null;
    document.documentElement.classList.remove('image-modal-open');
    document.body.classList.remove('image-modal-open');
    document.body.style.position = bodyStyle.position;
    document.body.style.top = bodyStyle.top;
    document.body.style.left = bodyStyle.left;
    document.body.style.right = bodyStyle.right;
    document.body.style.width = bodyStyle.width;
    window.scrollTo(scrollX, scrollY);
  }

  function close() {
    if (!modal || !preview) {
      return;
    }
    modal.classList.add('hidden');
    preview.src = '';
    state.photos = [];
    state.index = 0;
    resetTransform();
    state.suppressNextClick = false;
    unlockScroll();
  }

  function render() {
    const photo = state.photos[state.index];
    if (!photo) {
      close();
      return;
    }
    preview.src = photo.url;
    preview.alt = photo.label;
    const hasMultiplePhotos = state.photos.length > 1;
    if (prevButton) {
      prevButton.classList.toggle('hidden', !hasMultiplePhotos);
      prevButton.disabled = state.index <= 0;
    }
    if (nextButton) {
      nextButton.classList.toggle('hidden', !hasMultiplePhotos);
      nextButton.disabled = state.index >= state.photos.length - 1;
    }
    if (counter) {
      counter.classList.toggle('hidden', !hasMultiplePhotos);
      counter.textContent = hasMultiplePhotos ? `${state.index + 1} of ${state.photos.length}` : '';
    }
    for (const neighborIndex of [state.index - 1, state.index + 1]) {
      const neighbor = state.photos[neighborIndex];
      if (neighbor) {
        new Image().src = neighbor.url;
      }
    }
  }

  function step(delta) {
    const nextIndex = state.index + delta;
    if (nextIndex < 0 || nextIndex >= state.photos.length) {
      return;
    }
    resetTransform();
    state.index = nextIndex;
    render();
  }

  function open(photosOrUrl, startIndex) {
    if (!modal || !preview) {
      return;
    }
    state.photos = normalizePhotos(photosOrUrl);
    if (state.photos.length === 0) {
      return;
    }
    const requestedIndex = Math.floor(Number(startIndex));
    state.index = Number.isFinite(requestedIndex)
      ? Math.min(Math.max(0, requestedIndex), state.photos.length - 1)
      : 0;
    state.suppressNextClick = false;
    resetTransform();
    render();
    lockScroll();
    modal.classList.remove('hidden');
  }

  function startPinchGesture(event) {
    if (!event.touches || event.touches.length < 2) {
      return;
    }
    const firstTouch = event.touches[0];
    const secondTouch = event.touches[1];
    const center = touchCenter(firstTouch, secondTouch);
    const modalRect = modal.getBoundingClientRect();
    state.gesture = {
      mode: 'pinch',
      startDistance: Math.max(1, touchDistance(firstTouch, secondTouch)),
      startScale: state.scale,
      startCenterX: center.x,
      startCenterY: center.y,
      startTranslateX: state.translateX,
      startTranslateY: state.translateY,
      modalCenterX: modalRect.left + modalRect.width / 2,
      modalCenterY: modalRect.top + modalRect.height / 2,
      moved: false,
    };
  }

  function handleTouchStart(event) {
    if (modal.classList.contains('hidden')) {
      return;
    }
    state.suppressNextClick = false;
    if (event.touches.length >= 2) {
      event.preventDefault();
      startPinchGesture(event);
      return;
    }
    if (event.touches.length !== 1) {
      state.gesture = null;
      return;
    }
    const touch = event.touches[0];
    state.gesture = {
      mode: state.scale > MIN_SCALE ? 'pan' : 'swipe',
      startX: touch.clientX,
      startY: touch.clientY,
      startTranslateX: state.translateX,
      startTranslateY: state.translateY,
      startedOnImage: event.target === preview,
      moved: false,
    };
  }

  function maybeHandleDoubleTap(touch, options = {}) {
    if (!touch) {
      return false;
    }
    const now = Date.now();
    const previousTap = state.lastTap;
    state.lastTap = { at: now, x: touch.clientX, y: touch.clientY };
    if (
      !previousTap ||
      now - previousTap.at > DOUBLE_TAP_MS ||
      Math.hypot(touch.clientX - previousTap.x, touch.clientY - previousTap.y) > DOUBLE_TAP_DISTANCE
    ) {
      return false;
    }
    state.lastTap = null;
    if (state.scale <= MIN_SCALE) {
      if (!options.startedOnImage) {
        return false;
      }
      zoomAtPoint(touch.clientX, touch.clientY, DOUBLE_TAP_SCALE);
      state.suppressNextClick = true;
      return true;
    }
    resetTransform();
    state.suppressNextClick = true;
    return true;
  }

  function handleTouchMove(event) {
    if (modal.classList.contains('hidden') || !state.gesture) {
      return;
    }
    if (event.touches.length >= 2) {
      event.preventDefault();
      if (state.gesture.mode !== 'pinch') {
        startPinchGesture(event);
      }
      const firstTouch = event.touches[0];
      const secondTouch = event.touches[1];
      const center = touchCenter(firstTouch, secondTouch);
      const nextScale = clampNumber(
        (state.gesture.startScale * touchDistance(firstTouch, secondTouch)) / state.gesture.startDistance,
        MIN_SCALE,
        MAX_SCALE
      );
      const contentX =
        (state.gesture.startCenterX - state.gesture.modalCenterX - state.gesture.startTranslateX) /
        state.gesture.startScale;
      const contentY =
        (state.gesture.startCenterY - state.gesture.modalCenterY - state.gesture.startTranslateY) /
        state.gesture.startScale;
      state.scale = nextScale;
      state.translateX = center.x - state.gesture.modalCenterX - contentX * nextScale;
      state.translateY = center.y - state.gesture.modalCenterY - contentY * nextScale;
      state.gesture.moved = true;
      state.suppressNextClick = true;
      applyTransform();
      return;
    }
    if (event.touches.length !== 1) {
      return;
    }
    const touch = event.touches[0];
    const deltaX = touch.clientX - state.gesture.startX;
    const deltaY = touch.clientY - state.gesture.startY;
    const movedEnough = Math.hypot(deltaX, deltaY) > TAP_MOVE_THRESHOLD;
    if (movedEnough) {
      state.gesture.moved = true;
      state.suppressNextClick = true;
    }
    if (state.gesture.mode === 'pan' || state.scale > MIN_SCALE) {
      event.preventDefault();
      state.translateX = state.gesture.startTranslateX + deltaX;
      state.translateY = state.gesture.startTranslateY + deltaY;
      applyTransform();
    }
  }

  function handleTouchEnd(event) {
    if (!state.gesture) {
      return;
    }
    if (state.gesture.mode === 'swipe') {
      const touch = event.changedTouches && event.changedTouches[0];
      if (touch) {
        const deltaX = touch.clientX - state.gesture.startX;
        const deltaY = touch.clientY - state.gesture.startY;
        if (Math.abs(deltaX) >= 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
          event.preventDefault();
          state.suppressNextClick = true;
          step(deltaX < 0 ? 1 : -1);
        }
        if (!state.gesture.moved && maybeHandleDoubleTap(touch, state.gesture)) {
          event.preventDefault();
          state.gesture = null;
          return;
        }
      }
      state.gesture = null;
      return;
    }
    if (state.scale <= MIN_SCALE + 0.02) {
      resetTransform();
    } else {
      applyTransform();
    }
    const shouldContinuePan = event.touches && event.touches.length === 1 && state.scale > MIN_SCALE;
    if (shouldContinuePan) {
      const touch = event.touches[0];
      state.gesture = {
        mode: 'pan',
        startX: touch.clientX,
        startY: touch.clientY,
        startTranslateX: state.translateX,
        startTranslateY: state.translateY,
        moved: false,
      };
      return;
    }
    if (!state.gesture.moved) {
      const touch = event.changedTouches && event.changedTouches[0];
      if (maybeHandleDoubleTap(touch, state.gesture)) {
        event.preventDefault();
      }
    }
    state.gesture = null;
  }

  function handleTouchCancel() {
    state.gesture = null;
  }

  function handlePreviewPointerDown(event) {
    if (
      modal.classList.contains('hidden') ||
      state.scale <= MIN_SCALE ||
      event.pointerType !== 'mouse' ||
      event.button !== 0
    ) {
      return;
    }
    state.mouseGesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTranslateX: state.translateX,
      startTranslateY: state.translateY,
      moved: false,
    };
    if (typeof preview.setPointerCapture === 'function') {
      preview.setPointerCapture(event.pointerId);
    }
    modal.classList.add('image-modal-panning');
    event.preventDefault();
  }

  function handlePreviewPointerMove(event) {
    const gesture = state.mouseGesture;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (!gesture.moved && Math.hypot(deltaX, deltaY) <= TAP_MOVE_THRESHOLD) {
      return;
    }
    gesture.moved = true;
    state.translateX = gesture.startTranslateX + deltaX;
    state.translateY = gesture.startTranslateY + deltaY;
    applyTransform();
    event.preventDefault();
  }

  function handlePreviewPointerUp(event) {
    if (
      modal.classList.contains('hidden') ||
      event.pointerType !== 'mouse' ||
      event.button !== 0
    ) {
      return;
    }
    const gesture = state.mouseGesture;
    if (gesture && gesture.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    if (gesture) {
      const moved = gesture.moved;
      clearMouseGesture();
      if (moved) {
        applyTransform();
        return;
      }
    }
    if (state.scale <= MIN_SCALE) {
      zoomAtPoint(event.clientX, event.clientY, DOUBLE_TAP_SCALE);
      return;
    }
    resetTransform();
  }

  function handlePreviewPointerCancel(event) {
    if (state.mouseGesture && state.mouseGesture.pointerId === event.pointerId) {
      clearMouseGesture();
      applyTransform();
    }
  }

  closeButton?.addEventListener('click', close);
  modal?.addEventListener('click', (event) => {
    if (state.suppressNextClick) {
      event.preventDefault();
      event.stopPropagation();
      state.suppressNextClick = false;
      return;
    }
    if (
      event.target === modal ||
      (event.target instanceof Element && event.target.classList.contains('image-modal-backdrop'))
    ) {
      close();
    }
  });
  prevButton?.addEventListener('click', () => step(-1));
  nextButton?.addEventListener('click', () => step(1));
  modal?.addEventListener('touchstart', handleTouchStart, { passive: false });
  modal?.addEventListener('touchmove', handleTouchMove, { passive: false });
  modal?.addEventListener('touchend', handleTouchEnd, { passive: false });
  modal?.addEventListener('touchcancel', handleTouchCancel);
  preview?.addEventListener('pointerdown', handlePreviewPointerDown);
  preview?.addEventListener('pointermove', handlePreviewPointerMove);
  preview?.addEventListener('pointerup', handlePreviewPointerUp);
  preview?.addEventListener('pointercancel', handlePreviewPointerCancel);
  preview?.addEventListener('lostpointercapture', handlePreviewPointerCancel);
  preview?.addEventListener('dragstart', (event) => event.preventDefault());
  preview?.addEventListener('load', applyTransform);
  document.addEventListener('keydown', (event) => {
    if (!modal || modal.classList.contains('hidden')) {
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopImmediatePropagation();
      step(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopImmediatePropagation();
      step(1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  });

  return {
    close,
    open,
    step,
  };
}
