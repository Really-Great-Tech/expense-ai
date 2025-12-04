export enum CountryEventPattern {
  VALIDATE_REQUESTED = 'country.validate.requested',
  VALIDATED = 'country.validated',
  POLICY_REQUESTED = 'country.policy.requested',
  POLICY_RETRIEVED = 'country.policy.retrieved',
}

export interface CountryValidateRequestEvent {
  countryCode: string;
  requestId: string;
}

export interface CountryValidatedEvent {
  countryCode: string;
  isValid: boolean;
  requestId: string;
  error?: string;
}

export interface CountryPolicyRequestEvent {
  countryCode: string;
  requestId: string;
}

export interface CountryPolicyRetrievedEvent {
  countryCode: string;
  policies: any[];
  requestId: string;
}

