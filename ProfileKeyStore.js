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
const SECURITY_CONTEXT = 'https://w3id.org/security/v2';

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
    didv1.use('forge', forge);
    didv1.use('jsonld', jsonld);
    didv1.use('jsonld-signatures', this.jsigs);
  }

  async create({name, id, publicKey}) {
    if(!publicKey) {
      const {privateDidDocument} = await didv1.generate({
        name,
        didType: 'nym',
        keyType: 'Ed25519VerificationKey2018',
        passphrase: null,
        // TODO:
        env: 'dev'
      });
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
    const publicKey = profile.authentication[0].publicKey[0];
    const credential = {
      '@context': [
        {'@version': 1.1},
        IDENTITY_CONTEXT,
        SECURITY_CONTEXT
      ],
      id: 'urn:ephemeral:' + uuid(),
      type: ['Credential', 'CryptographicKeyCredential'],
      claim: {
        id: profile.id,
        publicKey: {
          id: publicKey.id,
          type: 'CryptographicKey',
          owner: profile.id,
          publicKeyBase58: publicKey.publicKeyBase58
        }
      }
    };

    const signedCredential = await this.sign({
      doc: credential,
      publicKeyId: publicKey.id,
      privateKeyBase58: publicKey.privateKey.privateKeyBase58,
      domain: domain
    });

    const unsignedProfile = {
      '@context': [
        {'@version': 1.1},
        IDENTITY_CONTEXT,
        SECURITY_CONTEXT
      ],
      id: profile.id,
      // TODO: use `verifiableCredential` and `credential/v2` context
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
      publicKeyId: publicKey.id,
      privateKeyBase58: publicKey.privateKey.privateKeyBase58
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
