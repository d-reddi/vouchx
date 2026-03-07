import { mountHub } from './hub-app.js';

mountHub({ inline: document.body.classList.contains('hub-inline') });
