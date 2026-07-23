// Backwards-compatible shim for the many pages/components that call `base44.auth.*` /
// `base44.entities.*` / `base44.integrations.Core.*` directly (a holdover from the base44 SDK
// object shape). Everything here is now backed by the self-hosted API client in
// src/api/entities.js and src/api/integrations.js — there is no base44 dependency anymore.
import * as Entities from './entities';
import { UploadFile } from './integrations';

const { User, ...entityMap } = Entities;

export const base44 = {
  auth: {
    me: User.me,
    updateMe: User.updateMyUserData,
    isAuthenticated: User.isAuthenticated,
    logout: () => {
      User.logout();
    },
    redirectToLogin: () => {
      window.location.href = '/login';
    },
  },
  entities: { ...entityMap, User },
  integrations: {
    Core: {
      UploadFile,
    },
  },
  appLogs: {
    logUserInApp: () => Promise.resolve(),
  },
};
