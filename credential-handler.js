/*!
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
/* global navigator */
'use strict';

import {WebAppContext} from 'web-request-rpc';

export async function activate(mediatorOrigin) {
  console.log('credential handler activating!');
  const CredentialHandler = navigator.credentialsPolyfill.CredentialHandler;
  const self = new CredentialHandler(mediatorOrigin);

  self.addEventListener('credentialrequest', handleCredentialEvent)
  self.addEventListener('credentialstore', handleCredentialEvent);

  await self.connect();
  console.log('credential handler connected');
}

function handleCredentialEvent(event) {
  event.respondWith(new Promise(async (resolve, reject) => {
    try {
      if(event.type === 'credentialrequest') {
        // TODO: if is a cryptokey request, do not use UI unless
        // user has no such key available from localstorage
        // TODO: handle and return early if key is in localstorage
      }

      // create WebAppContext to run WebApp and connect to windowClient
      const windowUrl = '/' + event.type;
      const appContext = new WebAppContext();
      const windowOpen = event.openWindow(windowUrl);
      const windowReady = appContext.createWindow(
        windowUrl, {handle: windowOpen});
      await windowOpen;

      // create proxy interface for making calls in WebApp
      const injector = await windowReady;
      const proxy = injector.get('credentialEventProxy', {
        functions: [{name: 'send', options: {timeout: 0}}]
      });

      // WebApp running in window is ready; proxy event to it
      resolve(proxy.send({
        type: event.type,
        credentialRequestOptions: event.credentialRequestOptions,
        credential: event.credential,
        hintKey: event.hintKey
      }));
    } catch(e) {
      reject(e);
    }
  }));
}
