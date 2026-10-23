import { Injectable, OnModuleInit } from '@nestjs/common';
import { App, cert, initializeApp } from 'firebase-admin/app';
import { Auth, DecodedIdToken, getAuth } from 'firebase-admin/auth';

import { AppConfigService } from '../../config/app-config.service';

/** Verifies ID tokens issued by Firebase Phone Auth on the client (§9.5 flag). */
@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private app!: App;
  private auth!: Auth;

  constructor(private readonly config: AppConfigService) {}

  onModuleInit(): void {
    this.app = initializeApp({
      credential: cert({
        projectId: this.config.firebaseProjectId,
        clientEmail: this.config.firebaseClientEmail,
        privateKey: this.config.firebasePrivateKey,
      }),
    });
    this.auth = getAuth(this.app);
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    return this.auth.verifyIdToken(idToken);
  }
}
