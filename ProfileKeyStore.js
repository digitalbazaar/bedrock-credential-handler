/*!
 * A ProfileKeyStore store profile and key information.
 *
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

import didv1 from 'did-veres-one';
import forge from 'node-forge';
import localforage from 'localforage';
import jsonld from 'jsonld';
import uuid from 'uuid/v4';
import Jsigs from 'jsonld-signatures';

// TODO: `IDENTITY_CONTEXT` is deprecated; replace
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

  async create({name, id, publicKey}) {
    if(!publicKey) {
      const {privateDidDocument} = await didv1.generate();
      privateDidDocument.name = name;
      return privateDidDocument;
    }

    // TODO: support creating DID document from existing `publicKey`
    throw new Error('Not implemented');
  }

  async sign({privateKeyBase58, publicKeyId, doc, domain}) {
    return this.jsigs.sign(doc, {
      algorithm: 'Ed25519Signature2018',
      creator: publicKeyId,
      privateKeyBase58,
      domain
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
          publicKeyBase58: profile.publicKey.publicKeyBase58
        }
      }
    };

    const signedCredential = await this.sign({
      doc: credential,
      publicKeyId: profile.publicKey.id,
      privateKeyBase58: profile.publicKey.privateKeyBase58,
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
      privateKeyBase58: profile.publicKey.privateKeyBase58
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
