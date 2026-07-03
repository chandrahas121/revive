// Shared API SDK for the Amazon Hackon monorepo.
// Both apps (consumer + seller) import the axios instance and endpoint helpers
// from here so the client stays in one place.
export { default } from './api/client.js';
export * from './api/client.js';

// Shared domain helpers (category capture prompts, condition labels, tier logic)
// used by both the consumer sell/return flows and the seller grading assistant.
export * from './categoryProfiles.js';
