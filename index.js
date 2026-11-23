/**
 * @format
 */

// Filter out insecure random generator warnings from DevTools and terminal logs
const _origWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Using an insecure random number generator')
  ) {
    return;
  }
  _origWarn(...args);
};

// Required by the face-auth encrypted template store before any app modules load.
import 'react-native-get-random-values';

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

LogBox.ignoreLogs([
  'Using an insecure random number generator',
]);

AppRegistry.registerComponent(appName, () => App);
