function OnDeviceFaceAuthView(props) {
  if (global.__mockOnDeviceAuthHandler) {
    global.__mockOnDeviceAuthHandler(props);
  }
  if (props && typeof props.onResult === 'function') {
    global.__lastOnDeviceResult = props.onResult;
  }
  return null;
}

module.exports = { OnDeviceFaceAuthView };
