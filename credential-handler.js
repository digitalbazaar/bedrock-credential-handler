/*!
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
/* global navigator */
'use strict';

import {ProfileKeyStore} from 'bedrock-credential-handler';
import {WebAppContext} from 'web-request-rpc';

const IDENTITY_CONTEXT = 'https://w3id.org/identity/v1';

export async function activate(mediatorOrigin) {
  const CredentialHandler = navigator.credentialsPolyfill.CredentialHandler;
  const self = new CredentialHandler(mediatorOrigin);

  self.addEventListener('credentialrequest', handleCredentialEvent)
  self.addEventListener('credentialstore', handleCredentialEvent);

  await self.connect();
}

function handleCredentialEvent(event) {
  event.respondWith(new Promise(async (resolve, reject) => {
    try {
      // attempt to handle crypto key requests without UI
      if(isCryptoKeyRequest(event)) {
        const pkStore = new ProfileKeyStore(window.location.pathname);
        const profile = await pkStore.get(event.hintKey);
        if(profile) {
          const domain = event.credentialRequestOrigin;
          const vProfile = await pkStore.createCryptoKeyProfile(
            {profile, domain, sign: true});
          return resolve({
            dataType: 'VerifiableProfile',
            data: vProfile
          });
        }
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

function isCryptoKeyRequest(event) {
  if(event.type !== 'credentialrequest') {
    return false;
  }
  let query = event.credentialRequestOptions.web.VerifiableProfile;
  if(query && typeof query === 'object') {
    // query may have `id` set -- this doesn't affect whether or not it is
    // a crypto key request
    query = Object.assign({}, query);
    delete query.id;
    return query.publicKey === '' &&
      (!('@context' in query) || query['@context'] === IDENTITY_CONTEXT);
  }
}
