/*!
 * A ProfileKeyStore store profile and key information.
 *
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

import forge from 'node-forge';
import localforage from 'localforage';
import jsonld from 'jsonld';
import uuid from 'uuid/v4';
import Jsigs from 'jsonld-signatures';

const IDENTITY_CONTEXT = 'https://w3id.org/identity/v1';

export class ProfileKeyStore {
  constructor(handlerUrl) {
    if(!(handlerUrl && typeof handlerUrl === 'string')) {
      throw new TypeError('"handlerUrl" must be a non-empty string.');
    }
    this._storage = localforage.createInstance(
      {name: 'profileKeyStore_' + handlerUrl});

    // initialize libs using helper libraries
    this.jsigs = Jsigs();
    this.jsigs.use('forge', forge);
    this.jsigs.use('jsonld', jsonld);
  }

  async create({id, label, publicKeyPem, privateKeyPem}) {
    if(!id) {
      // TODO: use did:method
      id = 'did:' + uuid();
    }
    if(!publicKeyPem) {
      const keys = await this.generateKeyPair();
      publicKeyPem = forge.pki.publicKeyToPem(keys.publicKey);
      privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    }
    return {
      '@context': 'https://w3id.org/identity/v1',
      id: id,
      label: label,
      publicKey: {
        id: id + '/keys/' + uuid(),
        type: 'CryptographicKey',
        owner: id,
        publicKeyPem,
        privateKeyPem
      }
    };
  }

  /**
   * Asynchronously generates a key pair.
   *
   * @return a Promise that resolves to a key pair.
   */
  async generateKeyPair() {
    return new Promise(function(resolve, reject) {
      forge.pki.rsa.generateKeyPair({
        // TODO: change to config value
        bits: 2048,
        workerScript: '/modules/forge/lib/prime.worker.js'
      }, function(err, keypair) {
        if(err) {
          return reject(err);
        }
        return resolve(keypair);
      });
    });
  }

  async sign({privateKeyPem, publicKeyId, doc, domain}) {
    const options = {
      algorithm: 'LinkedDataSignature2015',
      privateKeyPem,
      creator: publicKeyId,
      domain
    };
    return new Promise((resolve, reject) => {
      this.jsigs.sign(doc, options, (err, signed) => {
        if(err) {
          return reject(err);
        }
        resolve(signed);
      });
    });
  }

  async createCryptoKeyProfile({profile, domain, sign}) {
    // wrap public key in a CryptographicKeyCredential and sign it
    const credential = {
      '@context': IDENTITY_CONTEXT,
      id: 'urn:ephemeral:' + uuid(),
      type: ['Credential', 'CryptographicKeyCredential'],
      claim: {
        id: profile.id,
        publicKey: {
          id: profile.publicKey.id,
          type: 'CryptographicKey',
          owner: profile.id,
          publicKeyPem: profile.publicKey.publicKeyPem
        }
      }
    };

    const signedCredential = await this.sign({
      doc: credential,
      publicKeyId: profile.publicKey.id,
      privateKeyPem: profile.publicKey.privateKeyPem,
      domain: domain
    });

    const unsignedProfile = {
      '@context': IDENTITY_CONTEXT,
      id: profile.id,
      credential: [{
        '@graph': signedCredential
      }]
    };

    if(sign !== true) {
      return unsignedProfile;
    }

    // sign to create verifiable profile
    return await this.sign({
      doc: unsignedProfile,
      domain: domain,
      publicKeyId: profile.publicKey.id,
      privateKeyPem: profile.publicKey.privateKeyPem
    });
  }

  async delete(id) {
    if(!await this.has(id)) {
      return false;
    }
    await this._storage.removeItem(id);
    return true;
  }

  async get(id) {
    // TODO: implement validation
    //this._validateKey(id);
    return this._storage.getItem(id);
  }

  async keys() {
    await this._checkPermission();
    return this._storage.keys();
  }

  async has(id) {
    return await this.get(id) !== null;
  }

  async set(profile) {
    // TODO: implement validation
    //this._validateProfile(profile);
    //this._validateId(profile.id);
    await this._storage.setItem(profile.id, profile);
  }

  async clear() {
    return this._storage.clear();
  }
}
