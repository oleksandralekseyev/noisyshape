import './style.css';
import { createViewer } from './viewer';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('#app container not found');
}

createViewer(root);
