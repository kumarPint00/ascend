import React from 'react';
import {registerRootComponent} from 'expo';
import './src/phase2/maintenance';
import App from './src/App';
import {AppErrorBoundary} from './src/components/AppErrorBoundary';

function AscendRoot() {
  return <AppErrorBoundary><App/></AppErrorBoundary>;
}
registerRootComponent(AscendRoot);
