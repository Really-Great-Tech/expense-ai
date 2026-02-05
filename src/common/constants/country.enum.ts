/**
 * Hardcoded list of supported countries for expense processing.
 * Add new countries here when they are added to the database.
 */
export enum Country {
    AUSTRALIA = 'Australia',
    AUSTRIA = 'Austria',
    BELGIUM = 'Belgium',
    BRAZIL = 'Brazil',
    CHILE = 'Chile',
    CHINA = 'China',
    COLOMBIA = 'Colombia',
    CYPRUS = 'Cyprus',
    CZECH_REPUBLIC = 'Czech Republic',
    DENMARK = 'Denmark',
    EGYPT = 'Egypt',
    FRANCE = 'France',
    GERMANY = 'Germany',
    INDIA = 'India',
    INDONESIA = 'Indonesia',
    ITALY = 'Italy',
    JAPAN = 'Japan',
    LITHUANIA = 'Lithuania',
    LUXEMBOURG = 'Luxembourg',
    MALAYSIA = 'Malaysia',
    NETHERLANDS = 'Netherlands',
    PHILIPPINES = 'Philippines',
    SINGAPORE = 'Singapore',
    SOUTH_AFRICA = 'South Africa',
    SPAIN = 'Spain',
    SWITZERLAND = 'Switzerland',
    TAIWAN = 'Taiwan',
    UNITED_ARAB_EMIRATES = 'United Arab Emirates (UAE)',
    UNITED_KINGDOM = 'United Kingdom',
    VIETNAM = 'Vietnam',
}

/**
 * Array of all supported country values for dropdown/validation use.
 */
export const COUNTRIES = Object.values(Country);
