/**
 * @format
 */

// Required by the face-auth encrypted template store before any app modules load.
import 'react-native-get-random-values';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
