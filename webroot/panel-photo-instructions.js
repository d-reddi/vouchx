import { consumePhotoInstructionsLaunchMode, mountHub } from './hub-app.js';

mountHub({
  photoInstructionsOnly: true,
  photoInstructionsLaunchMode: consumePhotoInstructionsLaunchMode(),
});
