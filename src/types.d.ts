declare namespace App {
  interface Locals {
    user: import('./lib/types').AppUser | null;
    role: import('./lib/types').AppRole | null;
    otpRequired: boolean;
  }
}
