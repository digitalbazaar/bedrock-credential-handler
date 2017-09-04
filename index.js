/*!
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
/* global navigator */
'use strict';

// TODO: expose some credential request and store classes?
export {CredentialEventProxy} from './CredentialEventProxy.js';
export {activate as activateHandler} from './credential-handler.js';

export async function installHandler(handlerUrl) {
  console.log('installing credential handler...');

  const CredentialManager = navigator.credentialsPolyfill.CredentialManager;

  // ensure permission has been granted to add a credential hint
  const result = await CredentialManager.requestPermission();
  if(result !== 'granted') {
    throw new Error('Permission denied.');
  }

  const registration = await getHandlerRegistration(handlerUrl);
  if(!registration) {
    throw new Error('Credential handler not registered.');
  }

  console.log('credential handler installation complete.');
  return registration;
}

export async function uninstallHandler(handlerUrl) {
  console.log('uninstalling credential handler...');

  const CredentialHandlers = navigator.credentialsPolyfill.CredentialHandlers;
  const CredentialManager = navigator.credentialsPolyfill.CredentialManager;

  // ensure permission has been granted to add a credential hint
  const result = await CredentialManager.requestPermission();
  if(result !== 'granted') {
    throw new Error('Permission denied.');
  }

  // unregister credential handler registration
  await CredentialHandlers.unregister(handlerUrl);
  console.log('credential handler unregistered');

  console.log('credential handler uninstallation complete.');
}

export async function getHandlerRegistration(handlerUrl) {
  const CredentialHandlers = navigator.credentialsPolyfill.CredentialHandlers;

  let registration;
  try {
    // get credential handler registration
    registration = await CredentialHandlers.register(handlerUrl);
  } catch(e) {
    // ignore
  }
  return registration;
}
