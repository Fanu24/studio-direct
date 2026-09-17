import {safeNextPath} from '../profile/gate';

export type AccountPortal = 'candidate' | 'employer';

export function loginDestinations(portal: AccountPortal, next?: string | null) {
  const destination = safeNextPath(next) ?? (portal === 'employer' ? '/employer' : '/dashboard');
  const onboarding = portal === 'employer' ? '/employer/onboarding' : '/onboarding';
  return {
    callbackURL: destination,
    newUserCallbackURL: `${onboarding}?next=${encodeURIComponent(destination)}`,
    errorCallbackURL: portal === 'employer' ? '/employer/login?error=authentication_failed' : '/login?error=authentication_failed',
  };
}
