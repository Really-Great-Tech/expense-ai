/**
 * Policy data utilities - exports hardcoded country and ICP lists for dropdowns.
 *
 * These are manually maintained lists. When new countries or ICPs are added to the database,
 * they should be added to the respective enum files:
 * - src/common/constants/country.enum.ts
 * - src/common/constants/icp.enum.ts
 */

import { COUNTRIES } from '../common/constants/country.enum';
import { ICPS } from '../common/constants/icp.enum';

export const AVAILABLE_COUNTRIES = COUNTRIES;
export const AVAILABLE_ICPS = ICPS;
