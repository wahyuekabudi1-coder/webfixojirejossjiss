/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ==============================================================================
 * SMART JOURNEY FEATURE VISIBILITY & SERVICE ENABLED FLAGS
 * Single Source of Truth for Customer Front-End Service Availability
 * ==============================================================================
 * 
 * Rules & Operational Constraints:
 * 1. When a service flag is `false`:
 *    - It is completely hidden from Customer Front-End UI.
 *    - Hidden from Header desktop dropdown, mobile drawer, and service tabs.
 *    - Hidden from Footer quick links and services menu.
 *    - Hidden from Homepage quick services grid and showcase tabs.
 *    - Direct route navigation (e.g. /airport, /taxi, /car-rental) renders
 *      a friendly "Service Temporarily Unavailable" notice and blocks booking flows.
 * 2. When a service flag is `true`:
 *    - Re-enables the customer display, navigation, and booking flow immediately
 *      with ZERO code restoration or database changes needed.
 * 3. Scope Restriction:
 *    - Admin Dashboard, Database schema, REST APIs, Pricing, Payments (ArtoPay),
 *      and Operations remain 100% active, preserved, and manageable at all times.
 */

export interface ServiceVisibilityConfig {
  /** Private Tour packages across Bromo, Ijen, Bali, Tumpak Sewu */
  tours: boolean;
  /** Open Trip / Join Share Tour group departures */
  shareTour: boolean;
  /** 24/7 Airport Transfer (Juanda SUB, Bali DPS, YIA, CGK) */
  airport: boolean;
  /** Executive Intercity Taxi service */
  taxi: boolean;
  /** Car Rental with driver & self-drive fleet */
  carRental: boolean;
}

/**
 * Current Feature Visibility State
 * Customer Front-End active services: Private Tour & Open Trip ONLY.
 * Temporarily disabled for customer: Airport Transfer, Taxi, Car Rental.
 */
export const SERVICE_VISIBILITY: ServiceVisibilityConfig = {
  tours: true,       // ACTIVE for Customer
  shareTour: true,   // ACTIVE for Customer
  airport: false,    // DISABLED / HIDDEN for Customer
  taxi: false,       // DISABLED / HIDDEN for Customer
  carRental: false,  // DISABLED / HIDDEN for Customer
};

export type ServiceKey = 
  | 'tours' 
  | 'shareTour' 
  | 'share-tour' 
  | 'airport' 
  | 'taxi' 
  | 'carRental' 
  | 'car-rental';

/**
 * Helper to check whether a specific service is enabled on Customer Front-End.
 */
export function isServiceEnabled(service: ServiceKey): boolean {
  switch (service) {
    case 'tours':
      return Boolean(SERVICE_VISIBILITY.tours);
    case 'shareTour':
    case 'share-tour':
      return Boolean(SERVICE_VISIBILITY.shareTour);
    case 'airport':
      return Boolean(SERVICE_VISIBILITY.airport);
    case 'taxi':
      return Boolean(SERVICE_VISIBILITY.taxi);
    case 'carRental':
    case 'car-rental':
      return Boolean(SERVICE_VISIBILITY.carRental);
    default:
      return false;
  }
}
